import { Injectable, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WebSocketService, CallSignal } from './websocket.service';
import { ChatApiService } from './chat-api.service';
import { CallRingtonePlayer, RemoteAudioPlayer } from '../utils/call-audio.helper';
import { callLogContent } from '../utils/call-log.helper';
import { fixSdpString } from '../utils/call-sdp.helper';
import { MessageNotificationService } from './message-notification.service';
import { LocalMessageStoreService } from './local-message-store.service';

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
  accepting = signal(false);

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
  /** True after offer reached the server — hangup signal only sent when this is set. */
  private offerDelivered = false;
  private acceptingCall = false;

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  constructor(
    private ws: WebSocketService,
    private chatApi: ChatApiService,
    private messageNotification: MessageNotificationService,
    private localStore: LocalMessageStoreService
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
    this.offerDelivered = false;
    const id = crypto.randomUUID();
    const session = ++this.callSession;
    this.callId.set(id);
    this.remoteUserId.set(toUserId);
    this.remoteUsername.set(toUsername);
    this.state.set('outgoing');
    void this.ringtone.startOutgoing();

    try {
      await this.createPeerConnection();
      this.ensureAudioTransceiver();

      // Mic on call click (user gesture) — must be attached before offer for bidirectional audio.
      try {
        await this.captureLocalMic();
      } catch {
        this.error.set('Allow microphone access to start the call.');
        this.cleanup('failed');
        return;
      }

      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
      if (!this.canSendForSession(session, id)) {
        return;
      }

      const sent = await this.sendSignal({
        type: 'offer',
        toUserId,
        callId: id,
        sdp: this.toSdpInit(this.pc!.localDescription ?? offer)
      });
      if (!sent || !this.canSendForSession(session, id)) {
        this.error.set('Could not reach friend. Is backend running? Is friend logged in?');
        this.cleanup('failed');
        return;
      }
      this.offerDelivered = true;

      void this.ws.ensureConnected(15000).catch(() => {});
      void this.remoteAudio.unlockPlayback().catch(() => {});
    } catch {
      if (this.callSession === session) {
        this.error.set('Could not start call.');
        this.cleanup('failed');
      }
    }
  }

  async acceptCall(): Promise<void> {
    if (this.state() !== 'incoming' || this.acceptingCall) return;
    const callId = this.callId();
    const remoteId = this.remoteUserId();
    if (!callId || !remoteId) {
      this.error.set('Call data missing. Ask the caller to try again.');
      return;
    }

    this.acceptingCall = true;
    this.accepting.set(true);
    this.error.set(null);
    this.ringtone.stop();
    this.messageNotification.dismissCallNotification(callId);

    // Mic MUST be requested immediately on button click (browser user-gesture rule).
    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
    } catch {
      this.acceptingCall = false;
      this.accepting.set(false);
      this.error.set('Allow microphone access to answer the call.');
      void this.ringtone.startIncoming();
      return;
    }

    try {
      if (!this.pc) {
        await this.createPeerConnection();
      }
      if (!this.pc) {
        throw new Error('Peer connection not ready');
      }

      void this.remoteAudio.unlockPlayback();

      const remoteDesc =
        this.pendingRemoteDescription ??
        (this.pc.remoteDescription
          ? { type: this.pc.remoteDescription.type, sdp: this.pc.remoteDescription.sdp ?? '' }
          : null);

      if (!remoteDesc?.sdp?.trim()) {
        throw new Error('Call offer missing');
      }

      if (!this.pc.remoteDescription) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        this.pendingRemoteDescription = null;
        await this.flushCandidates();
      }

      this.attachLocalStream(micStream);
      this.setAudioTransceiversSendRecv();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      const sent = await this.sendSignal({
        type: 'answer',
        toUserId: remoteId,
        callId,
        sdp: this.toSdpInit(this.pc.localDescription ?? answer)
      });
      if (!sent) {
        throw new Error('Could not send answer');
      }

      this.markCallActive();
      await this.flushCandidates();
      await this.playRemoteAudio();
    } catch {
      micStream.getTracks().forEach((t) => t.stop());
      this.error.set('Could not connect call. Tap Accept again.');
      if (this.state() === 'incoming') {
        void this.ringtone.startIncoming();
      }
    } finally {
      this.acceptingCall = false;
      this.accepting.set(false);
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
    const callState = this.state();
    const shouldNotify = !!(
      to &&
      id &&
      (type === 'reject' ||
        callState === 'active' ||
        callState === 'incoming' ||
        (type === 'hangup' && this.offerDelivered))
    );
    if (id) {
      this.rememberCancelledCall(id);
    }
    this.callSession++;
    if (shouldNotify) {
      void this.sendSignal({ type, toUserId: to!, callId: id! }, true);
    }
    this.offerDelivered = false;
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
          void this.sendSignal({ type: 'reject', toUserId: sig.fromUserId, callId: sig.callId }, true);
          return;
        }
        if (this.state() !== 'idle') {
          void this.sendSignal({ type: 'reject', toUserId: sig.fromUserId, callId: sig.callId }, true);
          return;
        }
        this.callSession++;
        this.callId.set(sig.callId);
        this.remoteUserId.set(sig.fromUserId);
        this.remoteUsername.set(sig.fromUsername ?? 'Friend');
        this.state.set('incoming');
        void this.ringtone.startIncoming();
        this.messageNotification.notifyIncomingCall(sig);
        this.pendingRemoteDescription = this.normalizeRemoteSdp(sig.sdp);
        await this.createPeerConnection();
        await this.applyPendingRemoteDescription();
        break;
      case 'answer':
        if (
          this.state() === 'outgoing' &&
          sig.callId === this.callId() &&
          sig.sdp &&
          this.pc
        ) {
          this.ringtone.stop();
          const answerSdp = this.normalizeRemoteSdp(sig.sdp);
          if (!answerSdp) return;
          await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
          await this.ensureLocalMicAttached();
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
    return { type: desc.type as RTCSdpType, sdp: fixSdpString(desc.sdp ?? '') };
  }

  private normalizeRemoteSdp(sdp?: RTCSessionDescriptionInit | null): RTCSessionDescriptionInit | null {
    if (!sdp) return null;
    const body = typeof sdp.sdp === 'string' ? fixSdpString(sdp.sdp) : '';
    if (!body) return null;
    return { type: (sdp.type ?? 'offer') as RTCSdpType, sdp: body };
  }

  private async applyPendingRemoteDescription(): Promise<void> {
    if (!this.pc || !this.pendingRemoteDescription || this.pc.remoteDescription) {
      return;
    }
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(this.pendingRemoteDescription));
      this.pendingRemoteDescription = null;
      await this.flushCandidates();
    } catch (err) {
      console.warn('Could not apply remote offer', err);
    }
  }

  private async sendSignal(
    payload: {
      type: CallSignal['type'];
      toUserId: string;
      callId: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    },
    optional = false
  ): Promise<boolean> {
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
    } catch (err) {
      console.warn('Call signal failed', payload.type, err);
      if (optional) {
        return false;
      }
      try {
        await this.ws.ensureConnected(5000);
        return this.ws.sendCallSignal(payload);
      } catch {
        return false;
      }
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
        },
        true
      );
    };

    this.pc.ontrack = (e) => {
      if (e.track.kind !== 'audio') return;
      e.track.enabled = true;
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.remoteStream.set(stream);
      void this.remoteAudio.play(stream);
      e.track.onunmute = () => void this.remoteAudio.play(stream);
    };

    this.pc.oniceconnectionstatechange = () => {
      const ice = this.pc?.iceConnectionState;
      if (ice === 'connected' || ice === 'completed') {
        void this.playRemoteAudio();
      }
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

  private ensureAudioTransceiver(): void {
    if (!this.pc) return;
    if (this.findAudioSender()) return;
    this.pc.addTransceiver('audio', { direction: 'sendrecv' });
  }

  private findAudioSender(): RTCRtpSender | undefined {
    if (!this.pc) return undefined;
    const senderWithTrack = this.pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (senderWithTrack) return senderWithTrack;
    return this.pc.getTransceivers().find((t) => t.sender)?.sender;
  }

  private setAudioTransceiversSendRecv(): void {
    if (!this.pc) return;
    for (const transceiver of this.pc.getTransceivers()) {
      if (transceiver.sender.track?.kind === 'audio' || transceiver.receiver.track?.kind === 'audio') {
        transceiver.direction = 'sendrecv';
      }
    }
  }

  private async captureLocalMic(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    if (!this.pc) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.attachLocalStream(stream);
  }

  private async ensureLocalMicAttached(): Promise<void> {
    if (!this.pc) return;
    if (this.localStream()?.getAudioTracks().some((t) => t.readyState === 'live')) {
      return;
    }
    try {
      await this.captureLocalMic();
    } catch {
      this.error.set('Allow microphone access to speak on the call.');
    }
  }

  private attachLocalStream(stream: MediaStream): void {
    if (!this.pc) return;

    this.localStream()?.getTracks().forEach((t) => t.stop());
    this.localStream.set(stream);

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = true;

    const sender = this.findAudioSender();
    if (sender) {
      void sender.replaceTrack(audioTrack);
      return;
    }

    this.pc.addTrack(audioTrack, stream);
  }

  private async addLocalAudioTracks(): Promise<void> {
    if (!this.pc || this.localStream()?.getAudioTracks().some((t) => t.readyState === 'live')) {
      return;
    }
    await this.captureLocalMic();
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
    const clientMessageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      const msg = await firstValueFrom(
        this.chatApi.logCall(friendId, content, { clientMessageId, timestamp })
      );
      await this.localStore.saveMessage(msg, { friendId });
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
    this.offerDelivered = false;
  }
}
