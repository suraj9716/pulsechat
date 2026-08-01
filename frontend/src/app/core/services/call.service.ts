import { Injectable, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WebSocketService, CallSignal } from './websocket.service';
import { ChatApiService } from './chat-api.service';
import { CallRingtonePlayer, RemoteAudioPlayer, waitIceGathering } from '../utils/call-audio.helper';
import { callLogContent } from '../utils/call-log.helper';

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

  private pc: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private wsSub: { unsubscribe: () => void } | null = null;
  private ringtone = new CallRingtonePlayer();
  private remoteAudio = new RemoteAudioPlayer();
  private recvTransceiver: RTCRtpTransceiver | null = null;
  private callActiveAt: number | null = null;

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  constructor(
    private ws: WebSocketService,
    private chatApi: ChatApiService
  ) {}

  ngOnDestroy(): void {
    this.cleanup('failed');
    this.ringtone.dispose();
    this.remoteAudio.dispose();
  }

  startListening(): void {
    if (this.wsSub) return;
    this.wsSub = this.ws.subscribeCalls().subscribe((sig) => {
      void this.handleSignal(sig);
    });
  }

  async startCall(toUserId: string, toUsername: string): Promise<void> {
    if (this.state() !== 'idle') return;
    this.error.set(null);
    const id = crypto.randomUUID();
    this.callId.set(id);
    this.remoteUserId.set(toUserId);
    this.remoteUsername.set(toUsername);
    this.state.set('outgoing');
    void this.ringtone.startOutgoing();
    try {
      await this.createPeerConnection(true);
      const offer = await this.pc!.createOffer({ offerToReceiveAudio: true });
      await this.pc!.setLocalDescription(offer);
      await waitIceGathering(this.pc!);
      this.ws.sendCallSignal({
        type: 'offer',
        toUserId,
        callId: id,
        sdp: this.pc!.localDescription ?? offer
      });
    } catch {
      this.error.set('Could not start call. Allow microphone access.');
      this.cleanup('failed');
    }
  }

  async acceptCall(): Promise<void> {
    if (this.state() !== 'incoming' || !this.pc) return;
    this.error.set(null);
    this.ringtone.stop();
    try {
      await this.addLocalAudioTracks();
      const answer = await this.pc.createAnswer({ offerToReceiveAudio: true });
      await this.pc.setLocalDescription(answer);
      await waitIceGathering(this.pc);
      this.ws.sendCallSignal({
        type: 'answer',
        toUserId: this.remoteUserId()!,
        callId: this.callId()!,
        sdp: this.pc.localDescription ?? answer
      });
      this.markCallActive();
      await this.flushCandidates();
      const remote = this.remoteStream();
      if (remote) {
        void this.remoteAudio.play(remote);
      }
    } catch {
      this.error.set('Could not answer call.');
      this.rejectCall();
    }
  }

  rejectCall(): void {
    this.sendHangupOrReject('reject');
    this.cleanup('reject');
  }

  hangUp(): void {
    this.sendHangupOrReject('hangup');
    this.cleanup('hangup');
  }

  private sendHangupOrReject(type: 'reject' | 'hangup'): void {
    const to = this.remoteUserId();
    const id = this.callId();
    if (to && id) {
      this.ws.sendCallSignal({ type, toUserId: to, callId: id });
    }
  }

  private markCallActive(): void {
    this.callActiveAt = Date.now();
    this.state.set('active');
  }

  private async handleSignal(sig: CallSignal): Promise<void> {
    switch (sig.type) {
      case 'offer':
        if (this.state() !== 'idle') {
          this.ws.sendCallSignal({ type: 'reject', toUserId: sig.fromUserId, callId: sig.callId });
          return;
        }
        this.callId.set(sig.callId);
        this.remoteUserId.set(sig.fromUserId);
        this.remoteUsername.set(sig.fromUsername ?? 'Friend');
        this.state.set('incoming');
        void this.ringtone.startIncoming();
        await this.createPeerConnection(false);
        if (sig.sdp) {
          await this.pc!.setRemoteDescription(new RTCSessionDescription(sig.sdp));
        }
        break;
      case 'answer':
        if (this.state() === 'outgoing' && sig.sdp && this.pc) {
          this.ringtone.stop();
          await this.pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          this.markCallActive();
          await this.flushCandidates();
        }
        break;
      case 'ice':
        if (sig.candidate && this.pc) {
          if (!sig.candidate.candidate) return;
          if (this.pc.remoteDescription) {
            await this.pc.addIceCandidate(new RTCIceCandidate(sig.candidate)).catch(() => {});
          } else {
            this.pendingCandidates.push(sig.candidate);
          }
        }
        break;
      case 'reject':
      case 'hangup':
        if (!sig.callId || sig.callId === this.callId()) {
          this.cleanup('remote');
        }
        break;
    }
  }

  private async createPeerConnection(withLocalMic: boolean): Promise<void> {
    if (this.pc) return;
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

    this.recvTransceiver = this.pc.addTransceiver('audio', {
      direction: withLocalMic ? 'sendrecv' : 'recvonly'
    });

    this.pc.onicecandidate = (e) => {
      const to = this.remoteUserId();
      const id = this.callId();
      if (to && id) {
        this.ws.sendCallSignal({
          type: 'ice',
          toUserId: to,
          callId: id,
          candidate: e.candidate ? e.candidate.toJSON() : { candidate: '' }
        });
      }
    };

    this.pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.remoteStream.set(stream);
      void this.remoteAudio.play(stream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'disconnected') {
        this.error.set('Call connection lost.');
        this.cleanup('failed');
      }
    };

    if (withLocalMic) {
      await this.addLocalAudioTracks();
    }
  }

  private async addLocalAudioTracks(): Promise<void> {
    if (!this.pc) return;
    if (this.localStream()) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });
    this.localStream.set(stream);

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    if (this.recvTransceiver && this.recvTransceiver.sender.track == null) {
      await this.recvTransceiver.sender.replaceTrack(audioTrack);
      this.recvTransceiver.direction = 'sendrecv';
    } else {
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

  private cleanup(endReason: CallEndReason = 'remote'): void {
    if (endReason === 'hangup' || endReason === 'reject') {
      void this.logCallToChat(endReason);
    }

    this.ringtone.stop();
    this.remoteAudio.stop();

    this.localStream()?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.recvTransceiver = null;
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
