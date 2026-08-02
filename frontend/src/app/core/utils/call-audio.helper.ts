/** Hidden <audio> for remote WebRTC stream — stays in DOM for entire call. */
export class RemoteAudioPlayer {
  private el: HTMLAudioElement;
  private speakerDeviceId: string | null = null;

  constructor() {
    this.el = document.createElement('audio');
    this.el.autoplay = true;
    this.el.controls = false;
    this.el.preload = 'auto';
    this.el.setAttribute('playsinline', 'true');
    this.el.setAttribute('webkit-playsinline', 'true');
    this.el.setAttribute('x-webkit-airplay', 'allow');
    (this.el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    this.el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;';
    document.body.appendChild(this.el);
  }

  /** Call on user gesture (start/accept call) so mobile allows later remote playback. */
  async unlockPlayback(): Promise<void> {
    try {
      this.el.muted = true;
      await this.el.play();
      this.el.pause();
      this.el.muted = false;
      this.el.currentTime = 0;
    } catch {
      /* best effort */
    }
  }

  async play(stream: MediaStream): Promise<void> {
    const tracks = stream.getAudioTracks();
    tracks.forEach((t) => {
      t.enabled = true;
    });
    if (this.el.srcObject !== stream) {
      this.el.srcObject = stream;
    }
    this.el.volume = 1;
    this.el.muted = false;
    await this.applySpeaker();
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await this.el.play();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }

  private sinkId(id: string): Promise<void> {
    return (this.el as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(id);
  }

  async toggleSpeaker(): Promise<{ ok: boolean; fallback: boolean }> {
    if (this.hasSetSinkId()) {
      try {
        await navigator.mediaDevices.enumerateDevices();
        const outputs = (await navigator.mediaDevices.enumerateDevices())
          .filter((d) => d.kind === 'audiooutput');

        if (this.speakerDeviceId && this.speakerDeviceId !== 'fallback') {
          this.speakerDeviceId = null;
          await this.sinkId('');
          return { ok: true, fallback: false };
        }

        if (outputs.length > 0) {
          const speaker =
            outputs.find((d) => /speaker|loud|default/i.test(d.label)) ??
            outputs[outputs.length - 1];
          this.speakerDeviceId = speaker.deviceId;
          await this.sinkId(speaker.deviceId);
          return { ok: true, fallback: false };
        }
      } catch {
        /* try fallback below */
      }
    }

    // Mobile fallback (iOS / browsers without setSinkId): toggle UI + replay at full volume
    this.speakerDeviceId = this.speakerDeviceId === 'fallback' ? null : 'fallback';
    this.el.volume = 1;
    this.el.muted = false;
    try {
      await this.el.play();
    } catch {
      /* ignore */
    }
    return { ok: true, fallback: true };
  }

  isSpeakerOn(): boolean {
    return this.speakerDeviceId != null;
  }

  private hasSetSinkId(): boolean {
    return typeof (this.el as HTMLMediaElement & { setSinkId?: unknown }).setSinkId === 'function';
  }

  stop(): void {
    this.el.pause();
    this.el.srcObject = null;
    this.speakerDeviceId = null;
  }

  dispose(): void {
    this.stop();
    this.el.remove();
  }

  private async applySpeaker(): Promise<void> {
    if (this.speakerDeviceId && this.speakerDeviceId !== 'fallback' && this.hasSetSinkId()) {
      try {
        await this.sinkId(this.speakerDeviceId);
      } catch {
        this.speakerDeviceId = null;
      }
    }
  }
}

/**
 * Phone-style ringtone + ringback using Web Audio API (no external file needed).
 */
export class CallRingtonePlayer {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeNodes: OscillatorNode[] = [];

  async startIncoming(): Promise<void> {
    await this.ensureContext();
    this.stop();
    this.playIncomingPattern();
    this.timer = setInterval(() => this.playIncomingPattern(), 2800);
  }

  async startOutgoing(): Promise<void> {
    await this.ensureContext();
    this.stop();
    this.playOutgoingTone();
    this.timer = setInterval(() => this.playOutgoingTone(), 2000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.activeNodes.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
    this.activeNodes = [];
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private async ensureContext(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private playIncomingPattern(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(425, t, 0.4);
    this.playTone(480, t + 0.5, 0.4);
    this.playTone(425, t + 1.0, 0.4);
    this.playTone(480, t + 1.5, 0.4);
  }

  private playOutgoingTone(): void {
    if (!this.ctx) return;
    this.playTone(440, this.ctx.currentTime, 0.8);
  }

  private playTone(freq: number, start: number, duration: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
    gain.gain.setValueAtTime(0.25, start + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
    this.activeNodes.push(osc);
  }
}

export function waitIceGathering(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
    setTimeout(done, timeoutMs);
  });
}
