import { Injectable, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WebSocketService, CallSignal } from './websocket.service';
import { ChatApiService } from './chat-api.service';
import { CallRingtonePlayer, RemoteAudioPlayer } from '../utils/call-audio.helper';
import { callLogContent } from '../utils/call-log.helper';
import { MessageNotificationService } from './message-notification.service';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'active';

type CallEndReason = 'hangup' | 'reject' | 'remote' | 'failed';

@Injectable({ providedIn: 'root' })
export class CallService implements OnDestroy {
  state = signal<CallState>('idle');
  remoteUserId = signal<string | null>(null);
  remoteUsername = signal<string | null>(null);
  callId = signal<string | null>(null);
  localStream = signal<MediaStream | null>(null);
  remoteStream = signal<MediaStream | null>(null);
  error = signal<string | null>(null);
  speakerOn = signal(false);

  private pc: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private pendingRemoteDescription: RTCSessionDescriptionInit | null = null;
  private wsSub: { unsubscribe: () => void } | null = null;
  private ringtone = new CallRingtonePlayer();
  private remoteAudio = new RemoteAudioPlayer();
  private callActiveAt: number | null = null;
  private cancelledCallIds = new Set<string>();
  private callSession = 0;
  private recentSignalKeys = new Set<string>();

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  constructor(
    private ws: WebSocketService,
    private chatApi: ChatApiService,
    private messageNotification: MessageNotificationService
  ) {}

  ngOnDestroy(): void {
    this.cleanup('failed');
    this.ringtone.dispose();
    this.remoteAudio.dispose();
  }

  startListening(userId?: string | null): void {
    if (userId) {
      this.ws.ensureUserCallSubscription(userId);
    }
    if (this.wsSub) return;
    this.wsSub = this.ws.subscribeCalls(userId).subscribe((sig) => {
      void this.handleSignal(sig);
    });
  }

  async startCall(toUserId: string, toUsername: string): Promise<void> {
    if (this.state() !== 'idle') {
      this.error.set('Already in a call.');
      return;
    }
    this.error.set(null);
    const id = crypto.randomUUID();
    const session = ++this.callSession;
    this.callId.set(id);
    this.remoteUserId.set(toUserId);
    this.remoteUsername.set(toUsername);
    this.state.set('outgoing');
    void this.ringtone.startOutgoing();

    try {
      try {
        await this.ws.ensureConnected(15000);
      } catch {
        this.error.set('Cannot connect to server. Check internet and refresh the page.');
        this.cleanup('failed');
        return;
      }
      await this.remoteAudio.unlockPlayback();
      await this.createPeerConnection();
      await this.addLocalAudioTracks();

      const offer = await this.pc!.createOffer({ offerToReceiveAudio: true });
      await this.pc!.setLocalDescription(offer);
      if (!this.canSendForSession(session, id)) {
        this.error.set('Call was cancelled.');
        this.cleanup('failed');
        return;
      }

      const sent = await this.sendSignal({
        type: 'offer',
        toUserId,
        callId: id,
        sdp: this.toSdpInit(this.pc!.localDescription ?? offer)
      });
      if (!sent || !this.canSendForSession(session, id)) {
        this.error.set('Could not reach friend. Ask them to open PulseChat and stay logged in.');
        this.cleanup('failed');
      }
    } catch {
      if (this.callSession === session) {
        this.error.set('Could not start call. Allow microphone access.');
        this.cleanup('failed');
      }
    }
  }

  async acceptCall(): Promise<void> {
    if (this.state() !== 'incoming' || !this.pc) return;
    const callId = this.callId();
    const remoteId = this.remoteUserId();
    if (!callId || !remoteId) return;
    const session = this.callSession;
    this.error.set(null);
    this.ringtone.stop();
    this.messageNotification.dismissCallNotification(callId);

    try {
      await this.remoteAudio.unlockPlayback();
      if (this.pendingRemoteDescription) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(this.pendingRemoteDescription));
        this.pendingRemoteDescription = null;
        await this.flushCandidates();
      }
      await this.addLocalAudioTracks();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (!this.canSendForSession(session, callId)) return;

      const sent = await this.sendSignal({
        type: 'answer',
        toUserId: remoteId,
        callId,
        sdp: this.toSdpInit(this.pc.localDescription ?? answer)
      });
      if (!sent) return;

      this.markCallActive();
      await this.flushCandidates();
      await this.playRemoteAudio();
    } catch {
      if (this.callSession === session) {
        this.error.set('Could not answer call.');
        this.rejectCall();
      }
    }
  }

  async toggleSpeaker(): Promise<string | null> {
    const result = await this.remoteAudio.toggleSpeaker();
    this.speakerOn.set(this.remoteAudio.isSpeakerOn());
    if (result.fallback) {
      return this.speakerOn()
        ? 'Speaker mode on (use phone volume buttons)'
        : 'Earpiece mode';
    }
    return this.speakerOn() ? 'Speaker on' : 'Earpiece';
  }

  rejectCall(): void {
    this.endCall('reject');
  }

  hangUp(): void {
    this.endCall('hangup');
  }

  private endCall(type: 'reject' | 'hangup'): void {
    const to = this.remoteUserId();
    const id = this.callId();
    if (id) {
      this.rememberCancelledCall(id);
    }
    // Invalidate any in-flight offer/answer before cleanup so delayed publish is blocked.
    this.callSession++;
    if (to && id) {
      void this.sendSignal({ type, toUserId: to, callId: id });
    }
    this.cleanup(type, false);
  }

  private markCallActive(): void {
    this.callActiveAt = Date.now();
    this.state.set('active');
  }

  private async playRemoteAudio(): Promise<void> {
    const remote = this.remoteStream();
    if (remote) {
      await this.remoteAudio.play(remote);
    }
  }

  private async handleSignal(sig: CallSignal): Promise<void> {
    if (!this.shouldProcessSignal(sig)) return;

    switch (sig.type) {
      case 'offer':
        if (this.shouldRejectOffer(sig)) {
          void this.sendSignal({ type: 'reject', toUserId: sig.fromUserId, callId: sig.callId });
          return;
        }
        if (this.state() !== 'idle') {
          void this.sendSignal({ type: 'reject', toUserId: sig.fromUserId, callId: sig.callId });
          return;
        }
        this.callSession++;
        this.callId.set(sig.callId);
        this.remoteUserId.set(sig.fromUserId);
        this.remoteUsername.set(sig.fromUsername ?? 'Friend');
        this.state.set('incoming');
        void this.ringtone.startIncoming();
        this.messageNotification.notifyIncomingCall(sig);
        this.pendingRemoteDescription = sig.sdp ?? null;
        await this.createPeerConnection();
        break;
      case 'answer':
        if (
          this.state() === 'outgoing' &&
          sig.callId === this.callId() &&
          sig.sdp &&
          this.pc
        ) {
          this.ringtone.stop();
          await this.pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          this.markCallActive();
          await this.flushCandidates();
          await this.playRemoteAudio();
          setTimeout(() => void this.playRemoteAudio(), 500);
        }
        break;
      case 'ice':
        if (
          !sig.callId ||
          sig.callId !== this.callId() ||
          this.cancelledCallIds.has(sig.callId) ||
          !sig.candidate ||
          !this.pc
        ) {
          return;
        }
        if (!sig.candidate.candidate) return;
        if (this.pc.remoteDescription) {
          await this.pc.addIceCandidate(new RTCIceCandidate(sig.candidate)).catch(() => {});
        } else {
          this.pendingCandidates.push(sig.candidate);
        }
        break;
      case 'reject':
      case 'hangup':
        if (sig.callId) {
          this.rememberCancelledCall(sig.callId);
        }
        if (sig.callId && sig.callId === this.callId()) {
          this.cleanup('remote');
        }
        break;
    }
  }

  private shouldProcessSignal(sig: CallSignal): boolean {
    const candidate = sig.candidate?.candidate ?? '';
    const key = `${sig.type}:${sig.callId}:${sig.fromUserId}:${candidate}`;
    if (this.recentSignalKeys.has(key)) return false;
    this.recentSignalKeys.add(key);
    setTimeout(() => this.recentSignalKeys.delete(key), 3000);
    return true;
  }

  private shouldRejectOffer(sig: CallSignal): boolean {
    return !!(sig.callId && this.cancelledCallIds.has(sig.callId));
  }

  private toSdpInit(desc: RTCSessionDescription | RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    return { type: desc.type as RTCSdpType, sdp: desc.sdp ?? '' };
  }

  private async sendSignal(payload: {
    type: CallSignal['type'];
    toUserId: string;
    callId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }): Promise<boolean> {
    try {
      await firstValueFrom(
        this.chatApi.relayCallSignal({
          toUserId: payload.toUserId,
          type: payload.type,
          callId: payload.callId,
          sdp: payload.sdp,
          candidate: payload.candidate,
          sentAt: Date.now()
        })
      );
      return true;
    } catch {
      return this.ws.sendCallSignal(payload);
    }
  }

  private async createPeerConnection(): Promise<void> {
    if (this.pc) return;
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

    this.pc.onicecandidate = (e) => {
      const to = this.remoteUserId();
      const id = this.callId();
      if (!to || !id || this.state() === 'idle' || this.cancelledCallIds.has(id)) return;
      void this.sendSignal(
        {
          type: 'ice',
          toUserId: to,
          callId: id,
          candidate: e.candidate ? e.candidate.toJSON() : { candidate: '' }
        }
      );
    };

    this.pc.ontrack = (e) => {
      if (e.track.kind !== 'audio') return;
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.remoteStream.set(stream);
      void this.remoteAudio.play(stream);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        void this.playRemoteAudio();
      }
      if (state === 'failed' || state === 'disconnected') {
        this.error.set('Call connection lost.');
        this.cleanup('failed');
      }
    };
  }

  private async addLocalAudioTracks(): Promise<void> {
    if (!this.pc) return;

    const existingSender = this.pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (existingSender?.track) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    if (!this.pc) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    this.localStream.set(stream);

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const recvTransceiver = this.pc.getTransceivers().find(
      (t) => t.receiver.track?.kind === 'audio' || (t.mid && t.direction.includes('recv'))
    );

    if (recvTransceiver && !recvTransceiver.sender.track) {
      await recvTransceiver.sender.replaceTrack(audioTrack);
      recvTransceiver.direction = 'sendrecv';
    } else if (!existingSender) {
      this.pc.addTrack(audioTrack, stream);
    }
  }

  private async flushCandidates(): Promise<void> {
    if (!this.pc?.remoteDescription) return;
    for (const c of this.pendingCandidates) {
      if (c.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
    }
    this.pendingCandidates = [];
  }

  private async logCallToChat(endReason: 'hangup' | 'reject'): Promise<void> {
    const friendId = this.remoteUserId();
    if (!friendId) return;

    const wasActive = this.callActiveAt != null;
    const durationSeconds = wasActive
      ? Math.max(0, Math.floor((Date.now() - this.callActiveAt!) / 1000))
      : 0;
    const content = callLogContent(wasActive, durationSeconds, endReason);

    try {
      await firstValueFrom(this.chatApi.logCall(friendId, content));
    } catch {
      /* chat log is best-effort */
    }
  }

  private canSendForSession(session: number, callId: string): boolean {
    return (
      this.callSession === session &&
      this.callId() === callId &&
      this.state() !== 'idle' &&
      this.pc != null &&
      !this.cancelledCallIds.has(callId)
    );
  }

  private rememberCancelledCall(callId: string): void {
    this.cancelledCallIds.add(callId);
    setTimeout(() => this.cancelledCallIds.delete(callId), 120_000);
  }

  private cleanup(endReason: CallEndReason = 'remote', bumpSession = true): void {
    if (bumpSession) {
      this.callSession++;
    }
    this.messageNotification.dismissCallNotification(this.callId());

    const endedCallId = this.callId();
    if (endedCallId) {
      this.rememberCancelledCall(endedCallId);
    }

    if (endReason === 'hangup' || endReason === 'reject') {
      void this.logCallToChat(endReason);
    }

    this.ringtone.stop();
    this.remoteAudio.stop();
    this.speakerOn.set(false);

    this.localStream()?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.pendingRemoteDescription = null;
    this.pendingCandidates = [];
    this.callActiveAt = null;

    this.localStream.set(null);
    this.remoteStream.set(null);
    this.state.set('idle');
    this.remoteUserId.set(null);
    this.remoteUsername.set(null);
    this.callId.set(null);
  }
}
