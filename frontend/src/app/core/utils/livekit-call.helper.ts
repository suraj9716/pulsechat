import { Room, RoomEvent, Track } from 'livekit-client';

/** Stable voice calls through LiveKit Cloud / server (SFU). */
export class LiveKitCallSession {
  private room: Room | null = null;
  private remoteElements: HTMLMediaElement[] = [];

  async connect(
    url: string,
    token: string,
    handlers?: { onRemoteParticipant?: () => void; onDisconnected?: () => void }
  ): Promise<Room> {
    await this.disconnect();

    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.volume = 1;
      el.muted = false;
      el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;';
      document.body.appendChild(el);
      this.remoteElements.push(el);
      void el.play().catch(() => {});
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      handlers?.onRemoteParticipant?.();
    });

    room.on(RoomEvent.Disconnected, () => {
      handlers?.onDisconnected?.();
    });

    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    this.room = room;
    return room;
  }

  async disconnect(): Promise<void> {
    for (const el of this.remoteElements) {
      el.pause();
      el.remove();
    }
    this.remoteElements = [];
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
  }

  async setSpeakerOn(on: boolean): Promise<void> {
    for (const el of this.remoteElements) {
      el.volume = 1;
      el.muted = false;
      if (on) {
        await el.play().catch(() => {});
      }
    }
  }
}
