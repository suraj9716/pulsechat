import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  WebSocketService,
  IncomingFriendMessage,
  IncomingFriendRequest,
  CallSignal
} from './websocket.service';
import { UnreadCountService } from './unread-count.service';
import { APP_NAME } from '../constants/app.constants';

@Injectable({ providedIn: 'root' })
export class MessageNotificationService implements OnDestroy {
  private subs: Subscription[] = [];
  private baseTitle = APP_NAME;
  private activeRoomId: string | null = null;
  private permissionRequested = false;

  constructor(
    private ws: WebSocketService,
    private unread: UnreadCountService,
    private router: Router
  ) {}

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  startListening(): void {
    if (this.subs.length > 0) return;

    void this.ensureServiceWorker();
    void this.requestPermissionIfNeeded();

    this.subs.push(
      this.ws.subscribeFriendMessages().subscribe((msg) => this.onFriendMessage(msg)),
      this.ws.subscribeFriendRequests().subscribe((req) => this.onFriendRequest(req)),
      this.ws.subscribeCalls().subscribe((sig) => this.onCallSignal(sig))
    );

    this.updateDocumentTitle();
  }

  setActiveRoom(roomId: string | null): void {
    this.activeRoomId = roomId;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    this.permissionRequested = true;
    const result = await Notification.requestPermission();
    return result;
  }

  private async requestPermissionIfNeeded(): Promise<void> {
    if (!('Notification' in window) || this.permissionRequested) return;
    if (Notification.permission !== 'default') return;
    this.permissionRequested = true;
    try {
      await Notification.requestPermission();
    } catch {
      /* user dismissed or browser blocked */
    }
  }

  private async ensureServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch {
      /* offline or unsupported */
    }
  }

  private onFriendMessage(msg: IncomingFriendMessage): void {
    this.updateDocumentTitle();
    if (!this.shouldNotifyMessage(msg)) return;

    const title = msg.senderUsername ?? 'New message';
    const body = msg.preview || 'Sent you a message';
    const url = msg.roomType === 'FRIEND'
      ? `/friends/chat/${msg.senderId}`
      : '/chat';

    void this.show(title, body, url);
  }

  private onFriendRequest(req: IncomingFriendRequest): void {
    if (document.visibilityState === 'visible') return;
    const title = 'Friend request';
    const body = `${req.sender.username} wants to be friends`;
    void this.show(title, body, '/friends');
  }

  private onCallSignal(sig: CallSignal): void {
    if (sig.type !== 'offer') return;
    const title = 'Incoming call';
    const body = `${sig.fromUsername ?? 'Someone'} is calling`;
    void this.show(title, body, '/friends');
  }

  private shouldNotifyMessage(msg: IncomingFriendMessage): boolean {
    if (document.visibilityState !== 'visible') {
      return true;
    }
    if (this.unread.activeChatFriendId() === msg.senderId) {
      return false;
    }
    if (this.activeRoomId && this.activeRoomId === msg.roomId) {
      return false;
    }
    return true;
  }

  private updateDocumentTitle(): void {
    const count = this.unread.totalUnread();
    document.title = count > 0 ? `(${count}) ${this.baseTitle}` : this.baseTitle;
  }

  private async show(title: string, body: string, url: string): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const options: NotificationOptions = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'pulsechat-notification',
      data: { url }
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
        return;
      }
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        void this.router.navigateByUrl(url);
        n.close();
      };
    } catch {
      /* ignore notification errors */
    }
  }
}
