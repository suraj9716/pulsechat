import { Component, OnInit, OnDestroy, signal } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { Router, RouterLink, NavigationEnd } from '@angular/router';

import { MatCardModule } from '@angular/material/card';

import { MatButtonModule } from '@angular/material/button';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatInputModule } from '@angular/material/input';

import { MatIconModule } from '@angular/material/icon';

import { MatBadgeModule } from '@angular/material/badge';

import { MatTooltipModule } from '@angular/material/tooltip';

import { MatMenuModule } from '@angular/material/menu';

import {

  FriendApiService,

  FriendListItem,

  FriendRequest,

  UserSummary

} from '../../../core/services/friend-api.service';

import { BlockApiService } from '../../../core/services/block-api.service';

import { WebSocketService } from '../../../core/services/websocket.service';

import { UnreadCountService } from '../../../core/services/unread-count.service';

import { FriendNotificationService } from '../../../core/services/friend-notification.service';

import { Subscription, filter } from 'rxjs';



@Component({

  selector: 'app-friends',

  standalone: true,

  imports: [

    CommonModule,

    FormsModule,

    RouterLink,

    MatCardModule,

    MatButtonModule,

    MatFormFieldModule,

    MatInputModule,

    MatIconModule,

    MatBadgeModule,

    MatTooltipModule,

    MatMenuModule

  ],

  template: `

    <div class="friends-page">

      @if (pendingRequests().length > 0 || totalUnread() > 0) {

        <section class="section notifications-panel">

          <div class="section-head">

            <mat-icon>notifications_active</mat-icon>

            <h2>Notifications</h2>

            <span class="pill">{{ pendingRequests().length + (totalUnread() > 0 ? 1 : 0) }}</span>

          </div>

          @if (totalUnread() > 0) {

            <a class="notify-item message" routerLink="/friends">

              <mat-icon>mark_email_unread</mat-icon>

              <div class="notify-body">

                <strong>{{ totalUnread() }} unread message{{ totalUnread() > 1 ? 's' : '' }}</strong>

                <span>Scroll down to open your chats</span>

              </div>

              <mat-icon class="notify-arrow">chevron_right</mat-icon>

            </a>

          }

          @for (r of pendingRequests(); track r.id) {

            <div class="notify-item request">

              <mat-icon>person_add</mat-icon>

              <div class="notify-body">

                <strong>{{ r.sender.username }}</strong>

                <span>sent you a friend request</span>

              </div>

              <div class="notify-actions">

                <button mat-flat-button color="primary" (click)="accept(r.id)">Confirm Friend</button>

                <button mat-stroked-button (click)="reject(r.id)">Decline</button>

              </div>

            </div>

          }

        </section>

      }

      <header class="page-hero">

        <div class="hero-text">

          <h1>Friends</h1>

          <p>Connect, chat, and stay in touch with people you know.</p>

        </div>

      </header>



      <section class="section">

        <div class="section-head">

          <mat-icon>group</mat-icon>

          <h2>Your friends</h2>

          <span class="pill muted">{{ friends().length }}</span>

        </div>



        @if (friends().length === 0) {

          <div class="empty-state">

            <mat-icon>sentiment_dissatisfied</mat-icon>

            <p>No friends yet</p>

            <span>Search below or add someone from a chat match.</span>

          </div>

        } @else {

          <div class="friends-list">

            @for (item of friends(); track item.friend.id) {

              <div class="friend-row-wrap">

                <a class="friend-row" [routerLink]="['/friends/chat', item.friend.id]" (click)="openChat(item)">

                <div class="avatar-wrap">

                  <div class="avatar" [class.online-ring]="item.friend.onlineStatus">

                    {{ initials(item.friend.username) }}

                  </div>

                  @if (item.friend.onlineStatus) {

                    <span class="online-dot" matTooltip="Online"></span>

                  }

                </div>

                <div class="friend-body">

                  <div class="friend-top">

                    <span class="name">{{ item.friend.username }}</span>

                    @if (item.lastMessageAt) {

                      <span class="time">{{ item.lastMessageAt | date:'shortTime' }}</span>

                    }

                  </div>

                  <div class="friend-bottom">

                    @if (item.lastMessagePreview) {

                      <span class="preview" [class.unread-preview]="item.unreadCount > 0">

                        {{ item.lastMessagePreview }}

                      </span>

                    } @else {

                      <span class="preview muted">Tap to start chatting</span>

                    }

                  </div>

                </div>

                @if (item.unreadCount > 0) {

                  <span class="unread-badge">{{ item.unreadCount > 99 ? '99+' : item.unreadCount }}</span>

                } @else {

                  <mat-icon class="chevron">chevron_right</mat-icon>

                }

                </a>

                <button mat-icon-button class="friend-menu-btn" [matMenuTriggerFor]="friendMenu" (click)="$event.stopPropagation()">

                  <mat-icon>more_vert</mat-icon>

                </button>

                <mat-menu #friendMenu="matMenu">

                  <a mat-menu-item [routerLink]="['/profile', item.friend.id]">

                    <mat-icon>person</mat-icon> View Profile

                  </a>

                  <button mat-menu-item (click)="removeFriend(item.friend.id)">

                    <mat-icon>person_remove</mat-icon> Remove Friend

                  </button>

                  <button mat-menu-item (click)="blockFriend(item.friend.id)">

                    <mat-icon>block</mat-icon> Block

                  </button>

                </mat-menu>

              </div>

            }

          </div>

        }

      </section>



      <section class="section search-section">

        <div class="section-head">

          <mat-icon>search</mat-icon>

          <h2>Add a friend</h2>

        </div>

        <div class="search-box">

          <mat-form-field appearance="outline" class="search-field">

            <mat-label>Username</mat-label>

            <input matInput [(ngModel)]="searchQuery" (keydown.enter)="search()" placeholder="e.g. john_doe" />

            <mat-icon matPrefix>person_search</mat-icon>

          </mat-form-field>

          <button mat-flat-button color="primary" class="search-btn" (click)="search()">

            <mat-icon>search</mat-icon>

            Search

          </button>

        </div>



        @if (searchResults.length > 0) {

          <div class="search-results">

            @for (u of searchResults; track u.id) {

              <div class="search-row">

                <div class="avatar small">{{ initials(u.username) }}</div>

                <span class="name">{{ u.username }}</span>

                @if (isRequestSent(u.id)) {

                  <span class="sent-label">Request Sent</span>

                } @else {

                  <button mat-stroked-button color="primary" (click)="addFriend(u.id)">

                    <mat-icon>person_add</mat-icon>

                    Add

                  </button>

                }

              </div>

            }

          </div>

        }



        @if (addMessage) {

          <p class="toast" [class.error]="addMessageError">{{ addMessage }}</p>

        }

      </section>

    </div>

  `,

  styles: [`

    .friends-page {

      max-width: 720px;

      margin: 0 auto;

      padding: 24px 20px 48px;

    }

    .notifications-panel {

      border-left: 4px solid #667eea;

      margin-bottom: 20px;

    }

    .notify-item {

      display: flex;

      align-items: center;

      gap: 12px;

      padding: 12px 14px;

      border-radius: 12px;

      margin-bottom: 10px;

      text-decoration: none;

      color: inherit;

    }

    .notify-item:last-child { margin-bottom: 0; }

    .notify-item.message { background: #f0f4ff; }

    .notify-item.request { background: #fff8e8; flex-wrap: wrap; }

    .notify-item > mat-icon:first-child { color: #667eea; flex-shrink: 0; }

    .notify-item.request > mat-icon:first-child { color: #f57c00; }

    .notify-body { flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 2px; }

    .notify-body strong { font-size: 0.95rem; }

    .notify-body span { font-size: 0.82rem; color: #666; }

    .notify-arrow { color: #aaa; margin-left: auto; }

    .notify-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }



    .page-hero {

      display: flex;

      align-items: flex-start;

      justify-content: space-between;

      gap: 16px;

      padding: 28px 24px;

      border-radius: 20px;

      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

      color: #fff;

      margin-bottom: 24px;

      box-shadow: 0 12px 40px rgba(102, 126, 234, 0.35);

    }



    .hero-text h1 {

      margin: 0 0 6px;

      font-size: 1.75rem;

      font-weight: 700;

      letter-spacing: -0.02em;

    }



    .hero-text p {

      margin: 0;

      opacity: 0.9;

      font-size: 0.95rem;

    }



    .hero-badge {

      background: rgba(255, 255, 255, 0.2);

      backdrop-filter: blur(8px);

      padding: 8px 14px;

      border-radius: 999px;

      font-size: 0.85rem;

      font-weight: 600;

      white-space: nowrap;

    }

    .hero-badge.request { background: rgba(255, 152, 0, 0.35); }



    .section {

      background: #fff;

      border-radius: 16px;

      padding: 20px;

      margin-bottom: 20px;

      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

      border: 1px solid rgba(0, 0, 0, 0.04);

    }



    .section-head {

      display: flex;

      align-items: center;

      gap: 10px;

      margin-bottom: 16px;

    }



    .section-head h2 {

      margin: 0;

      font-size: 1.1rem;

      font-weight: 600;

      flex: 1;

    }



    .section-head mat-icon {

      color: #667eea;

    }



    .pill {

      background: #667eea;

      color: #fff;

      font-size: 0.75rem;

      font-weight: 600;

      padding: 4px 10px;

      border-radius: 999px;

    }



    .pill.muted {

      background: #eef0f6;

      color: #555;

    }



    .pending-section {

      border-left: 4px solid #667eea;

    }



    .pending-grid {

      display: flex;

      flex-direction: column;

      gap: 12px;

    }



    .pending-card {

      display: flex;

      align-items: center;

      gap: 14px;

      padding: 14px;

      background: #f8f9ff;

      border-radius: 12px;

      flex-wrap: wrap;

    }



    .pending-info {

      flex: 1;

      min-width: 140px;

      display: flex;

      flex-direction: column;

      gap: 2px;

    }



    .pending-info span {

      font-size: 0.85rem;

      color: #666;

    }



    .pending-actions {

      display: flex;

      gap: 8px;

    }



    .friends-list {

      display: flex;

      flex-direction: column;

      gap: 4px;

    }



    .friend-row-wrap {

      display: flex;

      align-items: center;

      gap: 2px;

    }



    .friend-menu-btn {

      flex-shrink: 0;

      color: #888;

    }



    .friend-row {

      display: flex;

      align-items: center;

      gap: 14px;

      padding: 12px 10px;

      border-radius: 12px;

      text-decoration: none;

      color: inherit;

      transition: background 0.15s ease, transform 0.15s ease;

      cursor: pointer;

    }



    .friend-row:hover {

      background: #f5f7ff;

      transform: translateX(2px);

    }



    .avatar-wrap {

      position: relative;

      flex-shrink: 0;

    }



    .avatar {

      width: 48px;

      height: 48px;

      border-radius: 50%;

      background: linear-gradient(145deg, #667eea, #764ba2);

      color: #fff;

      display: flex;

      align-items: center;

      justify-content: center;

      font-weight: 700;

      font-size: 1rem;

      letter-spacing: 0.02em;

    }



    .avatar.small {

      width: 40px;

      height: 40px;

      font-size: 0.85rem;

    }



    .avatar.online-ring {

      box-shadow: 0 0 0 2px #fff, 0 0 0 4px #4caf50;

    }



    .online-dot {

      position: absolute;

      bottom: 2px;

      right: 2px;

      width: 12px;

      height: 12px;

      background: #4caf50;

      border: 2px solid #fff;

      border-radius: 50%;

    }



    .friend-body {

      flex: 1;

      min-width: 0;

    }



    .friend-top, .friend-bottom {

      display: flex;

      justify-content: space-between;

      align-items: baseline;

      gap: 8px;

    }



    .name {

      font-weight: 600;

      font-size: 1rem;

    }



    .time {

      font-size: 0.75rem;

      color: #888;

      flex-shrink: 0;

    }



    .preview {

      font-size: 0.875rem;

      color: #777;

      white-space: nowrap;

      overflow: hidden;

      text-overflow: ellipsis;

      max-width: 100%;

      display: block;

      margin-top: 2px;

    }



    .preview.unread-preview {

      color: #333;

      font-weight: 600;

    }



    .preview.muted {

      font-style: italic;

    }



    .unread-badge {

      min-width: 24px;

      height: 24px;

      padding: 0 7px;

      background: linear-gradient(135deg, #667eea, #764ba2);

      color: #fff;

      border-radius: 999px;

      font-size: 0.75rem;

      font-weight: 700;

      display: flex;

      align-items: center;

      justify-content: center;

      flex-shrink: 0;

    }



    .chevron {

      color: #ccc;

      flex-shrink: 0;

    }



    .empty-state {

      text-align: center;

      padding: 32px 16px;

      color: #888;

    }



    .empty-state mat-icon {

      font-size: 48px;

      width: 48px;

      height: 48px;

      opacity: 0.4;

      margin-bottom: 8px;

    }



    .empty-state p {

      margin: 0 0 4px;

      font-size: 1.1rem;

      color: #555;

      font-weight: 500;

    }



    .search-box {

      display: flex;

      gap: 12px;

      align-items: flex-start;

      flex-wrap: wrap;

    }



    .search-field {

      flex: 1;

      min-width: 200px;

    }



    .search-btn mat-icon {

      margin-right: 4px;

      vertical-align: middle;

      font-size: 18px;

      width: 18px;

      height: 18px;

    }



    .search-results {

      margin-top: 16px;

      display: flex;

      flex-direction: column;

      gap: 8px;

    }



    .search-row {

      display: flex;

      align-items: center;

      gap: 12px;

      padding: 10px 12px;

      background: #f8f9ff;

      border-radius: 10px;

    }



    .search-row .name {

      flex: 1;

    }

    .sent-label {

      font-size: 0.8rem; font-weight: 600; color: #5c6bc0;

      background: #e8eaf6; padding: 6px 12px; border-radius: 999px;

    }

    .toast {

      margin: 12px 0 0;

      padding: 10px 14px;

      background: #e8f5e9;

      color: #2e7d32;

      border-radius: 8px;

      font-size: 0.9rem;

    }



    .toast.error {

      background: #ffebee;

      color: #c62828;

    }

    @media (max-width: 768px) {

      .friends-page { padding: 12px 12px 32px; }

      .notify-item.request { flex-direction: column; align-items: stretch; }

      .notify-actions { margin-left: 0; width: 100%; }

      .notify-actions button { flex: 1; }

      .page-hero {

        flex-direction: column;

        align-items: flex-start;

        padding: 20px 18px;

        border-radius: 16px;

      }

      .hero-text h1 { font-size: 1.4rem; }

      .hero-badge { align-self: flex-start; white-space: normal; }

      .section { padding: 16px; }

      .search-box { flex-direction: column; }

      .search-box mat-form-field { width: 100%; }

      .search-row { flex-wrap: wrap; }

      .search-row button { width: 100%; }

      .pending-card { flex-direction: column; align-items: stretch; }

      .pending-actions { width: 100%; }

      .pending-actions button { flex: 1; }

      .friend-row { padding: 10px 8px; gap: 10px; }

      .avatar { width: 44px; height: 44px; }

    }

  `]

})

export class FriendsComponent implements OnInit, OnDestroy {

  friends = signal<FriendListItem[]>([]);

  pendingRequests = this.friendNotification.pendingRequests;

  searchResults: UserSummary[] = [];

  searchQuery = '';

  addMessage = '';

  addMessageError = false;

  sentUserIds = new Set<string>();

  totalUnread = this.unread.totalUnread;

  pendingCount = this.friendNotification.pendingCount;

  private wsSub: Subscription | null = null;

  private msgSub: Subscription | null = null;

  private navSub: Subscription | null = null;



  constructor(

    private friendApi: FriendApiService,

    private blockApi: BlockApiService,

    private ws: WebSocketService,

    private unread: UnreadCountService,

    private friendNotification: FriendNotificationService,

    private router: Router

  ) {}



  ngOnInit(): void {

    this.ws.connect();

    this.friendNotification.startListening();

    this.loadFriends();

    this.friendNotification.refreshPending();

    this.unread.startListening();

    this.wsSub = this.ws.subscribeFriendRequests().subscribe(() => {

      this.friendNotification.refreshPending();

      this.loadFriends();

    });

    this.msgSub = this.ws.subscribeFriendMessages().subscribe(() => this.loadFriends());

    this.navSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.router.url === '/friends') {
        this.loadFriends();
        this.friendNotification.refreshPending();
      }
    });

  }



  ngOnDestroy(): void {

    this.wsSub?.unsubscribe();

    this.msgSub?.unsubscribe();

    this.navSub?.unsubscribe();

  }



  initials(name: string): string {

    return (name || '?').slice(0, 2).toUpperCase();

  }



  loadFriends(): void {

    this.friendApi.getFriendsOverview().subscribe({

      next: (items) => {

        this.friends.set(items);

        this.unread.applyOverview(items);

      },

      error: () => {

        this.friendApi.getFriends().subscribe((list) => {

          this.friends.set(list.map((f) => ({

            friend: f,

            unreadCount: this.unread.unreadFor(f.id)

          })));

        });

      }

    });

  }



  loadPending(): void {

    this.friendNotification.refreshPending();

  }



  search(): void {

    const q = this.searchQuery?.trim();

    if (!q) return;

    this.addMessage = '';

    this.friendApi.searchUsers(q).subscribe((r) => {

      this.searchResults = r;

      this.friendApi.getPendingSent().subscribe((sent) => {

        sent.forEach((req) => this.sentUserIds.add(req.receiver.id));

      });

    });

  }



  addFriend(userId: string): void {

    if (this.sentUserIds.has(userId)) return;

    this.addMessage = '';

    this.addMessageError = false;

    this.friendApi.sendRequest(userId).subscribe({

      next: () => {

        this.sentUserIds.add(userId);

        this.addMessage = 'Friend request sent!';

      },

      error: (err) => {

        this.addMessageError = true;

        const msg = err.error?.error ?? '';

        if (msg.includes('Already friends')) {

          this.addMessage = 'You are already friends.';

        } else if (msg.includes('Request already sent') || msg.includes('already sent')) {

          this.sentUserIds.add(userId);

          this.addMessage = 'Friend request already sent.';

        } else {

          this.addMessage = msg || 'Could not send request';

        }

      }

    });

  }



  isRequestSent(userId: string): boolean {

    return this.sentUserIds.has(userId);

  }



  openChat(item: FriendListItem): void {

    if (item.roomId && item.unreadCount > 0) {

      this.unread.markFriendRead(item.friend.id, item.roomId);

    }

  }



  accept(requestId: string): void {

    this.friendApi.accept(requestId).subscribe(() => {

      this.loadPending();

      this.loadFriends();

      this.friendNotification.onRequestHandled();

    });

  }



  reject(requestId: string): void {

    this.friendApi.reject(requestId).subscribe(() => {

      this.loadPending();

      this.friendNotification.onRequestHandled();

    });

  }



  removeFriend(friendId: string): void {

    if (!confirm('Remove this friend? Chat history will be deleted.')) return;

    this.friendApi.removeFriend(friendId).subscribe(() => {
      this.unread.refreshFromOverview();
      this.loadFriends();
    });

  }



  blockFriend(friendId: string): void {

    if (!confirm('Block this user? They will not be able to message you.')) return;

    this.blockApi.blockUser(friendId).subscribe(() => this.loadFriends());

  }

}


