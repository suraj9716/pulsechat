import { Injectable, signal, computed } from '@angular/core';
import { ChatApiService } from './chat-api.service';
import { FriendApiService, FriendListItem } from './friend-api.service';
import { WebSocketService, IncomingFriendMessage } from './websocket.service';
import { LocalMessageStoreService } from './local-message-store.service';
import { Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UnreadCountService {
  private friendUnreadMap = signal<Record<string, number>>({});
  overviewItems = signal<FriendListItem[]>([]);
  activeChatFriendId = signal<string | null>(null);
  private wsSub: Subscription | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private lastRefreshAt = 0;
  private readonly minIntervalMs = 8000;

  totalUnread = computed(() =>
    Object.values(this.friendUnreadMap()).reduce((sum, n) => sum + n, 0)
  );

  constructor(
    private chatApi: ChatApiService,
    private friendApi: FriendApiService,
    private ws: WebSocketService,
    private localStore: LocalMessageStoreService
  ) {}

  startListening(): void {
    if (this.wsSub) return;
    this.wsSub = this.ws.subscribeFriendMessages().subscribe((msg) => this.handleIncoming(msg));
  }

  stopListening(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = null;
  }

  /** Debounced — avoids hammering /api/friends/overview. */
  refreshFromOverview(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastRefreshAt < this.minIntervalMs) {
      if (!this.refreshTimer) {
        this.refreshTimer = setTimeout(() => {
          this.refreshTimer = null;
          this.refreshFromOverview(true);
        }, this.minIntervalMs - (now - this.lastRefreshAt));
      }
      return;
    }
    if (this.inFlight) {
      if (!this.refreshTimer) {
        this.refreshTimer = setTimeout(() => {
          this.refreshTimer = null;
          this.refreshFromOverview(true);
        }, 1500);
      }
      return;
    }
    this.inFlight = true;
    this.friendApi.getFriendsOverview().subscribe({
      next: (items) => {
        this.inFlight = false;
        this.lastRefreshAt = Date.now();
        this.applyOverview(items);
      },
      error: () => {
        this.inFlight = false;
      }
    });
  }

  applyOverview(items: FriendListItem[]): void {
    void this.mergeLocalMeta(items).then((merged) => {
      this.overviewItems.set(merged);
      const map: Record<string, number> = {};
      for (const item of merged) {
        if (item.unreadCount > 0) {
          map[item.friend.id] = item.unreadCount;
        }
      }
      this.friendUnreadMap.set(map);
    });
  }

  private async mergeLocalMeta(items: FriendListItem[]): Promise<FriendListItem[]> {
    const local = await this.localStore.getAllConversations();
    const byFriend = new Map(local.map((c) => [c.friendId, c]));
    return items.map((item) => {
      const meta = byFriend.get(item.friend.id);
      if (!meta) return item;
      return {
        ...item,
        unreadCount: Math.max(item.unreadCount, meta.unreadCount),
        lastMessagePreview: meta.lastMessagePreview ?? item.lastMessagePreview,
        lastMessageAt: meta.lastMessageAt ?? item.lastMessageAt
      };
    });
  }

  unreadFor(friendId: string): number {
    return this.friendUnreadMap()[friendId] ?? 0;
  }

  markFriendRead(friendId: string, roomId: string): void {
    void this.localStore.markRoomRead(roomId, friendId).then(() => {
      this.friendUnreadMap.update((m) => {
        const next = { ...m };
        delete next[friendId];
        return next;
      });
    });
  }

  setActiveChat(friendId: string | null): void {
    this.activeChatFriendId.set(friendId);
  }

  refreshTotal(): void {
    this.refreshFromOverview(true);
  }

  private handleIncoming(msg: IncomingFriendMessage): void {
    if (this.activeChatFriendId() === msg.senderId) return;
    this.friendUnreadMap.update((m) => ({
      ...m,
      [msg.senderId]: (m[msg.senderId] ?? 0) + 1
    }));
    void this.localStore.saveMessage(
      {
        id: msg.messageId,
        senderId: msg.senderId,
        receiverId: msg.senderId,
        chatRoomId: msg.roomId,
        content: msg.preview,
        messageType: 'TEXT',
        status: 'SENT',
        timestamp: msg.timestamp
      },
      { friendId: msg.senderId, incrementUnread: true }
    );
  }
}
