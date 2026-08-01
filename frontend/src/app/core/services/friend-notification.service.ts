import { Injectable, signal, computed } from '@angular/core';
import { FriendApiService, FriendRequest } from './friend-api.service';
import { UnreadCountService } from './unread-count.service';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { Subscription, interval } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FriendNotificationService {
  pendingCount = signal(0);
  pendingRequests = signal<FriendRequest[]>([]);
  private wsSub: Subscription | null = null;
  private pollSub: Subscription | null = null;

  /** Badge for Friends nav: pending requests + unread messages */
  friendsBadge = computed(() => this.pendingCount() + this.unread.totalUnread());

  constructor(
    private friendApi: FriendApiService,
    private unread: UnreadCountService,
    private ws: WebSocketService,
    private auth: AuthService
  ) {}

  startListening(): void {
    if (this.wsSub) {
      this.refreshPending();
      return;
    }
    this.ws.connect();
    const userId = this.auth.user()?.id;
    this.refreshPending();
    this.wsSub = this.ws.subscribeFriendRequests().subscribe(() => {
      this.refreshPending();
    });
    this.ws.subscribeUserFriendRequests(userId).subscribe(() => {
      this.refreshPending();
    });
    if (!this.pollSub) {
      this.pollSub = interval(15000).subscribe(() => this.refreshPending());
    }
  }

  refreshPending(): void {
    this.friendApi.getPendingRequests().subscribe({
      next: (r) => {
        this.pendingCount.set(r.length);
        this.pendingRequests.set(r);
      },
      error: () => {
        this.pendingCount.set(0);
        this.pendingRequests.set([]);
      }
    });
  }

  onRequestHandled(): void {
    this.refreshPending();
  }
}
