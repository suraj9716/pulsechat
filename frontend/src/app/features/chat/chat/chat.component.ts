import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';

import { MatButtonModule } from '@angular/material/button';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatInputModule } from '@angular/material/input';

import { MatIconModule } from '@angular/material/icon';

import { MatMenuModule } from '@angular/material/menu';

import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../core/services/auth.service';

import { ChatApiService, ChatRoomResponse, MessageResponse } from '../../../core/services/chat-api.service';

import { MatchmakingApiService } from '../../../core/services/matchmaking-api.service';

import { WebSocketService, ChatMessage } from '../../../core/services/websocket.service';

import { FriendApiService, FriendStatusResponse } from '../../../core/services/friend-api.service';

import { UserApiService, PublicUserProfile } from '../../../core/services/user-api.service';

import { BlockApiService } from '../../../core/services/block-api.service';

import { UnreadCountService } from '../../../core/services/unread-count.service';

import { FriendNotificationService } from '../../../core/services/friend-notification.service';

import { MessageNotificationService } from '../../../core/services/message-notification.service';

import { ChatMessagingService } from '../../../core/services/chat-messaging.service';

import { SearchPartnerDialogComponent, SearchPartnerDialogData } from '../search-partner-dialog/search-partner-dialog.component';

import { APP_NAME } from '../../../core/constants/app.constants';

import { mediaUrl } from '../../../core/utils/media-url';

import { Subscription, filter, skip } from 'rxjs';

import { environment } from '../../../../environments/environment';



@Component({

  selector: 'app-chat',

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

    MatMenuModule,

    MatDialogModule,

    MatSnackBarModule

  ],

  template: `

    <div class="chat-page">

      @if (!currentRoom()) {

        <div class="home-dashboard">

          <div class="home-bg"></div>

          <section class="match-top-card" (click)="openSearchDialog()">

            <div class="match-top-glow"></div>

            <div class="match-top-content">

              <div class="match-top-icon"><mat-icon>shuffle</mat-icon></div>

              <div class="match-top-text">

                <h2>Start Matching</h2>

                <p>Meet someone new instantly — pick a preference and go</p>

              </div>

              <button mat-fab color="primary" class="match-go-btn" (click)="openSearchDialog(); $event.stopPropagation()">

                <mat-icon>play_arrow</mat-icon>

              </button>

            </div>

          </section>



          @if (incomingPendingRequests().length > 0 || totalUnread() > 0) {

            <section class="notifications-panel">

              <div class="notifications-head">

                <mat-icon>notifications_active</mat-icon>

                <h2>Notifications</h2>

                @if (incomingPendingRequests().length + (totalUnread() > 0 ? 1 : 0) > 0) {

                  <span class="notify-count">{{ incomingPendingRequests().length + (totalUnread() > 0 ? 1 : 0) }}</span>

                }

              </div>

              @if (totalUnread() > 0) {

                <a class="notify-item message" routerLink="/friends">

                  <mat-icon>mark_email_unread</mat-icon>

                  <div class="notify-body">

                    <strong>{{ totalUnread() }} unread message{{ totalUnread() > 1 ? 's' : '' }}</strong>

                    <span>Tap to open your chats</span>

                  </div>

                  <mat-icon class="notify-arrow">chevron_right</mat-icon>

                </a>

              }

              @for (r of incomingPendingRequests(); track r.id) {

                <div class="notify-item request">

                  <mat-icon>person_add</mat-icon>

                  <div class="notify-body">

                    <strong>{{ r.sender.username }}</strong>

                    <span>sent you a friend request</span>

                  </div>

                  <div class="notify-actions">

                    <button mat-flat-button color="primary" (click)="acceptHomeRequest(r.id)">Confirm</button>

                    <button mat-stroked-button (click)="rejectHomeRequest(r.id)">Decline</button>

                  </div>

                </div>

              }

            </section>

          }



          <header class="home-hero compact">

            <div class="hero-badge-app"><mat-icon>bolt</mat-icon> {{ appName }}</div>

            <div class="hero-content">

              <span class="greeting">Hey there 👋</span>

              <h1>{{ auth.user()?.username }}</h1>

              <p>Connect, chat & make new friends instantly</p>

            </div>

          </header>



            <div class="stats-row">

            <a class="stat-card" routerLink="/friends">

              <mat-icon>group</mat-icon>

              <span class="stat-num">{{ recentFriends().length }}</span>

              <span class="stat-label">Friends</span>

            </a>

            <a class="stat-card" routerLink="/friends">

              <mat-icon>chat</mat-icon>

              <span class="stat-num">{{ totalUnread() }}</span>

              <span class="stat-label">Unread</span>

            </a>

            <a class="stat-card" routerLink="/friends">

              <mat-icon>notifications</mat-icon>

              <span class="stat-num">{{ pendingRequestCount() }}</span>

              <span class="stat-label">Requests</span>

            </a>

          </div>



          <section class="search-section glass">

            <h2><mat-icon>person_search</mat-icon> Search & connect</h2>

            <p class="section-sub">Find anyone by username and start chatting</p>

            <div class="search-row">

              <mat-form-field appearance="outline" class="search-field">

                <mat-label>Username</mat-label>

                <input matInput [(ngModel)]="searchQuery" (keydown.enter)="searchUsers()" placeholder="Search users..." />

              </mat-form-field>

              <button mat-flat-button color="primary" (click)="searchUsers()">Search</button>

            </div>

            @if (searchResults().length > 0) {

              <div class="search-results">

                @for (u of searchResults(); track u.id) {

                  <div class="search-result">

                    <div class="avatar link" [routerLink]="['/profile', u.id]">{{ initials(u.username) }}</div>

                    <div class="info link" [routerLink]="['/profile', u.id]">

                      <span class="name">{{ u.username }}</span>

                      <span class="meta">{{ u.gender === 'FEMALE' ? 'Female' : 'Male' }} · {{ u.onlineStatus ? 'Online' : 'Offline' }}</span>

                    </div>

                    <button mat-stroked-button color="primary" (click)="messageUser(u.id)">

                      <mat-icon>chat</mat-icon> Message

                    </button>

                    @if (userStatus(u.id)?.friends) {

                      <span class="tag friends">Friends</span>

                    } @else if (userStatus(u.id)?.pendingSent) {

                      <span class="tag sent">Request Sent</span>

                    } @else if (userStatus(u.id)?.pendingReceived) {

                      <button mat-flat-button color="primary" (click)="confirmFriendFromSearch(u.id)">Confirm Friend</button>

                    } @else {

                      <button mat-stroked-button (click)="addFriendFromSearch(u.id)">

                        <mat-icon>person_add</mat-icon> Add

                      </button>

                    }

                  </div>

                }

              </div>

            }

          </section>



          <div class="action-cards">

            <mat-card class="action-card friends-card" routerLink="/friends">

              <div class="card-icon-wrap"><mat-icon>group</mat-icon></div>

              <h3>My Friends

                @if (friendsBadge() > 0) {

                  <span class="mini-badge">{{ friendsBadge() }}</span>

                }

              </h3>

              <p>Chat, call & stay connected with your friends</p>

              @if (recentFriends().length > 0) {

                <div class="recent-friends">

                  @for (f of recentFriends(); track f.friend.id) {

                    <a class="recent-chip" [routerLink]="['/friends/chat', f.friend.id]" (click)="$event.stopPropagation()">

                      {{ f.friend.username }}

                      @if (f.unreadCount > 0) {

                        <span class="chip-badge">{{ f.unreadCount }}</span>

                      }

                    </a>

                  }

                </div>

              }

              <button mat-stroked-button color="primary">Open Friends</button>

            </mat-card>

          </div>

        </div>

      } @else {

        <div class="chat-shell">

          <header class="chat-header">

            <div class="avatar">{{ initials(currentRoom()!.participant.username) }}</div>

            <div class="header-info">

              <a class="name" [routerLink]="['/profile', currentRoom()!.participant.id]">

                {{ currentRoom()!.participant.username }}

              </a>

              <span class="status" [class.online]="currentRoom()!.participant.onlineStatus">

                {{ currentRoom()!.participant.onlineStatus ? 'Online' : 'Offline' }}

              </span>

            </div>

            <div class="header-actions">

              @if (isFriend()) {

                <span class="friend-badge">Friends</span>

              } @else if (pendingReceived()) {

                <span class="friend-prompt">{{ currentRoom()!.participant.username }} sent a friend request</span>

                <button mat-flat-button color="primary" (click)="acceptIncomingRequest()">Confirm Friend</button>

                <button mat-button (click)="rejectIncomingRequest()">Decline</button>

              } @else if (friendRequestSent()) {

                <button mat-button disabled>Friend Request Sent</button>

              } @else {

                <button mat-stroked-button (click)="addFriend()">Add Friend</button>

              }

              @if (!isFriend()) {

              <button mat-button (click)="nextPartner()">Next</button>

              }

              <button mat-icon-button [matMenuTriggerFor]="partnerMenu"><mat-icon>more_vert</mat-icon></button>

              <mat-menu #partnerMenu="matMenu">

                <a mat-menu-item [routerLink]="['/profile', currentRoom()!.participant.id]">

                  <mat-icon>person</mat-icon> View Profile

                </a>

                <button mat-menu-item (click)="blockPartner()">

                  <mat-icon>block</mat-icon> Block User

                </button>

              </mat-menu>

            </div>

          </header>



          <div class="messages-container">

            @for (msg of messages(); track msg.id) {

              @if (msg.messageType === 'CALL') {

                <div class="call-log-row">

                  <div class="call-log-bubble">

                    <mat-icon>call</mat-icon>

                    <span>{{ msg.content }}</span>

                    <span class="call-time">{{ msg.timestamp | date:'shortTime' }}</span>

                  </div>

                </div>

              } @else {

                <div class="message-row" [class.sent]="isSentByMe(msg)">

                  <div class="bubble">

                    @if (msg.messageType === 'IMAGE' && msg.imageUrl) {

                      <img [src]="imageSrc(msg.imageUrl)" alt="Shared image" class="chat-image" />

                    }

                    @if (msg.content) {

                      <span class="content">{{ msg.content }}</span>

                    }

                    <span class="time">{{ msg.timestamp | date:'shortTime' }}</span>

                  </div>

                </div>

              }

            }

            @if (typingUserId()) {

              <div class="typing-indicator">{{ currentRoom()!.participant.username }} is typing...</div>

            }

          </div>



          <footer class="composer">

            <input #imageInput type="file" accept="image/*" hidden (change)="onImageSelected($event)" />

            <button mat-icon-button type="button" (click)="imageInput.click()"><mat-icon>photo_camera</mat-icon></button>

            <mat-form-field appearance="outline" class="message-input" subscriptSizing="dynamic">

              <input matInput [(ngModel)]="newMessage" (keydown.enter)="send()" placeholder="Type a message..." />

            </mat-form-field>

            <button mat-fab color="primary" class="send-btn" (click)="send()" [disabled]="!newMessage.trim()">

              <mat-icon>send</mat-icon>

            </button>

          </footer>

        </div>

      }

    </div>

  `,

  styles: [`

    .chat-page { min-height: calc(100vh - 64px); background: #eef1fb; position: relative; }

    .home-dashboard { max-width: 900px; margin: 0 auto; padding: 24px 20px 48px; position: relative; }

    .match-top-card {

      position: relative; overflow: hidden;

      padding: 20px 22px; border-radius: 20px; margin-bottom: 16px;

      background: linear-gradient(135deg, #667eea 0%, #764ba2 55%, #5b4bb7 100%);

      color: #fff; cursor: pointer;

      box-shadow: 0 16px 40px rgba(102, 126, 234, 0.35);

      transition: transform 0.15s, box-shadow 0.15s;

    }

    .match-top-card:hover { transform: translateY(-2px); box-shadow: 0 20px 48px rgba(102, 126, 234, 0.42); }

    .match-top-glow {

      position: absolute; top: -40px; right: -30px; width: 140px; height: 140px;

      border-radius: 50%; background: rgba(255,255,255,0.12); pointer-events: none;

    }

    .match-top-content { display: flex; align-items: center; gap: 16px; position: relative; }

    .match-top-icon {

      width: 52px; height: 52px; border-radius: 14px;

      background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;

    }

    .match-top-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }

    .match-top-text { flex: 1; min-width: 0; }

    .match-top-text h2 { margin: 0 0 4px; font-size: 1.35rem; font-weight: 800; }

    .match-top-text p { margin: 0; opacity: 0.92; font-size: 0.9rem; }

    .match-go-btn { flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,0.2) !important; }

    .notifications-panel {

      background: #fff; border-radius: 16px; padding: 16px 18px; margin-bottom: 16px;

      box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid rgba(102,126,234,0.12);

    }

    .notifications-head {

      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;

    }

    .notifications-head h2 { margin: 0; flex: 1; font-size: 1.05rem; font-weight: 700; }

    .notifications-head mat-icon { color: #667eea; }

    .notify-count {

      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;

      font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 999px;

    }

    .notify-item {

      display: flex; align-items: center; gap: 12px; padding: 12px 14px;

      border-radius: 12px; margin-bottom: 8px; text-decoration: none; color: inherit;

    }

    .notify-item:last-child { margin-bottom: 0; }

    .notify-item.message { background: #f0f4ff; }

    .notify-item.request { background: #fff8e8; flex-wrap: wrap; }

    .notify-item > mat-icon:first-child { color: #667eea; flex-shrink: 0; }

    .notify-item.request > mat-icon:first-child { color: #f57c00; }

    .notify-body { flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 2px; }

    .notify-body strong { font-size: 0.95rem; }

    .notify-body span { font-size: 0.82rem; color: #666; }

    .notify-arrow { color: #aaa; }

    .notify-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }

    .home-hero.compact { padding: 24px 24px; margin-bottom: 16px; }

    .home-bg {

      position: absolute; inset: 0; pointer-events: none; overflow: hidden;

    }

    .home-bg::before, .home-bg::after {

      content: ''; position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.35;

    }

    .home-bg::before { width: 280px; height: 280px; background: #667eea; top: -40px; right: -20px; }

    .home-bg::after { width: 220px; height: 220px; background: #764ba2; bottom: 80px; left: -40px; }

    .home-hero {

      position: relative;

      padding: 32px 28px; border-radius: 24px;

      background: linear-gradient(135deg, #667eea 0%, #764ba2 55%, #5b4bb7 100%);

      color: #fff; margin-bottom: 20px;

      box-shadow: 0 20px 50px rgba(102, 126, 234, 0.4);

      overflow: hidden;

    }

    .home-hero::after {

      content: ''; position: absolute; top: -60px; right: -60px;

      width: 180px; height: 180px; border-radius: 50%;

      background: rgba(255,255,255,0.08);

    }

    .hero-badge-app {

      display: inline-flex; align-items: center; gap: 6px;

      background: rgba(255,255,255,0.15); padding: 6px 14px;

      border-radius: 999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 12px;

    }

    .hero-badge-app mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .greeting { font-size: 0.95rem; opacity: 0.92; }

    .home-hero h1 { margin: 6px 0 8px; font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; }

    .home-hero p { margin: 0; opacity: 0.9; font-size: 1rem; }

    .hero-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }

    .notify-chip {

      display: inline-flex; align-items: center; gap: 6px;

      padding: 10px 16px; border-radius: 999px; color: #fff;

      text-decoration: none; font-weight: 600; font-size: 0.85rem;

      animation: pulse-soft 2s ease-in-out infinite;

    }

    .notify-chip.request { background: rgba(255, 152, 0, 0.35); border: 1px solid rgba(255,255,255,0.3); }

    .notify-chip.message { background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); }

    @keyframes pulse-soft { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }

    .stats-row {

      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;

    }

    .stat-card {

      background: #fff; border-radius: 16px; padding: 16px; text-align: center;

      box-shadow: 0 4px 16px rgba(0,0,0,0.06); cursor: pointer;

      transition: transform 0.15s, box-shadow 0.15s; text-decoration: none; color: inherit;

    }

    .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(102,126,234,0.15); }

    .stat-card mat-icon { color: #667eea; font-size: 28px; width: 28px; height: 28px; }

    .stat-num { display: block; font-size: 1.5rem; font-weight: 800; color: #333; margin: 4px 0; }

    .stat-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }

    .glass {

      background: rgba(255,255,255,0.85) !important;

      backdrop-filter: blur(12px);

      border: 1px solid rgba(255,255,255,0.6);

    }

    .section-sub { margin: -8px 0 16px; color: #777; font-size: 0.9rem; }

    .tag {

      font-size: 0.75rem; font-weight: 600; padding: 6px 12px; border-radius: 999px; white-space: nowrap;

    }

    .tag.sent { background: #e8eaf6; color: #5c6bc0; }

    .tag.friends { background: #e8f5e9; color: #2e7d32; }

    .unread-chip {

      display: flex; align-items: center; gap: 6px;

      background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);

      padding: 10px 16px; border-radius: 999px; color: #fff;

      text-decoration: none; font-weight: 600; font-size: 0.9rem;

    }

    .search-section {

      background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 20px;

      box-shadow: 0 2px 12px rgba(0,0,0,0.06);

    }

    .search-section h2 {

      display: flex; align-items: center; gap: 8px; margin: 0 0 16px;

      font-size: 1.05rem; font-weight: 600;

    }

    .search-section h2 mat-icon { color: #667eea; }

    .search-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }

    .search-field { flex: 1; min-width: 200px; }

    .search-results { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }

    .search-result {

      display: flex; align-items: center; gap: 12px; padding: 10px 12px;

      background: #f8f9ff; border-radius: 10px; text-decoration: none; color: inherit;

      transition: background 0.15s;

    }

    .search-result:hover { background: #eef1fb; }

    .search-result .info { flex: 1; }

    .search-result .link { cursor: pointer; }

    .search-result .name { font-weight: 600; display: block; }

    .search-result .meta { font-size: 0.8rem; color: #888; }

    .avatar {

      width: 44px; height: 44px; border-radius: 50%;

      background: linear-gradient(145deg, #667eea, #764ba2);

      color: #fff; display: flex; align-items: center; justify-content: center;

      font-weight: 700; flex-shrink: 0;

    }

    .action-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }

    .action-card {

      padding: 24px; border-radius: 20px; cursor: pointer;

      transition: transform 0.2s, box-shadow 0.2s;

      text-decoration: none; color: inherit; display: block;

      border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.08);

    }

    .action-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(102,126,234,0.18); }

    .card-icon-wrap {

      width: 52px; height: 52px; border-radius: 14px;

      background: #eef1fb; display: flex; align-items: center; justify-content: center;

      margin-bottom: 12px;

    }

    .card-icon-wrap.primary { background: linear-gradient(135deg, #667eea22, #764ba244); }

    .card-icon-wrap mat-icon { font-size: 28px; width: 28px; height: 28px; color: #667eea; }

    .match-card { background: linear-gradient(160deg, #fff 60%, #f3f0ff 100%); }

    .friends-card { background: linear-gradient(160deg, #fff 60%, #eef1fb 100%); }

    .action-card h3 { margin: 0 0 8px; font-size: 1.15rem; display: flex; align-items: center; gap: 8px; }

    .action-card p { color: #666; font-size: 0.9rem; margin: 0 0 16px; line-height: 1.45; }

    .action-card mat-icon { font-size: 36px; width: 36px; height: 36px; color: #667eea; margin-bottom: 8px; }

    .action-card.primary mat-icon { color: #764ba2; }

    .mini-badge {

      background: linear-gradient(135deg, #667eea, #764ba2);

      color: #fff; font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;

    }

    .recent-friends { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

    .recent-chip {

      display: inline-flex; align-items: center; gap: 4px;

      padding: 4px 10px; background: #eef1fb; border-radius: 999px;

      font-size: 0.8rem; text-decoration: none; color: #333;

    }

    .chip-badge {

      background: #667eea; color: #fff; font-size: 0.7rem;

      padding: 1px 6px; border-radius: 999px; font-weight: 700;

    }

    .chat-shell {

      max-width: 820px; margin: 16px auto; height: calc(100vh - 96px);

      display: flex; flex-direction: column; background: #fff;

      border-radius: 20px; overflow: hidden;

      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.12);

    }

    .chat-header {

      display: flex; align-items: center; gap: 12px; padding: 14px 16px;

      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; flex-wrap: wrap;

    }

    .header-info { flex: 1; min-width: 120px; }

    .header-info .name { color: #fff; font-weight: 600; font-size: 1.05rem; text-decoration: none; display: block; }

    .header-info .name:hover { text-decoration: underline; }

    .status { font-size: 0.8rem; opacity: 0.85; }

    .status.online::before { content: '● '; color: #a5f3a5; }

    .header-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    .messages-container { flex: 1; overflow-y: auto; padding: 20px 16px; background: #f8f9fd; }

    .message-row { display: flex; margin-bottom: 10px; }

    .message-row.sent { justify-content: flex-end; }

    .bubble {

      max-width: 75%; padding: 10px 14px; border-radius: 16px;

      background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.06);

    }

    .message-row.sent .bubble {

      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;

      border-bottom-right-radius: 4px;

    }

    .message-row:not(.sent) .bubble { border-bottom-left-radius: 4px; }

    .content { display: block; word-break: break-word; line-height: 1.45; }

    .time { font-size: 0.7rem; opacity: 0.75; display: block; margin-top: 4px; text-align: right; }

    .chat-image { max-width: 240px; max-height: 240px; border-radius: 10px; display: block; margin-bottom: 4px; }

    .typing-indicator { font-style: italic; color: #666; padding: 8px; }

    .composer {

      display: flex; align-items: center; gap: 8px;

      padding: 12px 16px 16px; background: #fff; border-top: 1px solid #eee;

    }

    .message-input { flex: 1; margin: 0; }

    .send-btn { width: 48px; height: 48px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4); }

    .friend-prompt { font-size: 0.85rem; margin-right: 6px; }

    .friend-badge {

      font-size: 0.8rem;

      font-weight: 600;

      color: #2e7d32;

      background: rgba(46, 125, 50, 0.12);

      padding: 4px 10px;

      border-radius: 999px;

    }

    .call-log-row { display: flex; justify-content: center; margin: 12px 0; }

    .call-log-bubble {

      display: inline-flex; align-items: center; gap: 8px;

      padding: 8px 14px; border-radius: 999px;

      background: #eef1fb; color: #555; font-size: 0.85rem;

      box-shadow: 0 1px 4px rgba(0,0,0,0.05);

    }

    .call-log-bubble mat-icon { font-size: 18px; width: 18px; height: 18px; color: #667eea; }

    .call-time { font-size: 0.72rem; opacity: 0.75; margin-left: 4px; }

    @media (max-width: 768px) {

      .home-dashboard { padding: 12px 12px 32px; }

      .match-top-card { padding: 16px; margin-bottom: 12px; }

      .match-top-text h2 { font-size: 1.15rem; }

      .match-top-content { gap: 12px; }

      .notify-item.request { flex-direction: column; align-items: stretch; }

      .notify-actions { margin-left: 0; width: 100%; }

      .notify-actions button { flex: 1; }

      .home-hero { padding: 24px 20px; border-radius: 18px; }

      .home-hero h1 { font-size: 1.5rem; }

      .stats-row { grid-template-columns: 1fr; gap: 10px; }

      .stat-card { display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px 16px; }

      .stat-card mat-icon { margin: 0; }

      .stat-num { font-size: 1.25rem; margin: 0; }

      .search-section { padding: 16px; }

      .search-row { flex-direction: column; }

      .search-field { width: 100%; min-width: 0; }

      .search-result { flex-wrap: wrap; }

      .action-cards { grid-template-columns: 1fr; }

      .chat-page { min-height: calc(100dvh - 56px); }

      .chat-shell {

        margin: 0;

        height: calc(100dvh - 56px);

        border-radius: 0;

        box-shadow: none;

      }

      .chat-header { padding: 10px 12px; gap: 8px; }

      .header-actions { width: 100%; justify-content: flex-end; }

      .header-actions button { transform: scale(0.9); }

      .bubble { max-width: 88%; }

      .chat-image { max-width: min(240px, 70vw); max-height: min(240px, 50vh); }

      .composer { padding: 8px 10px 12px; gap: 4px; }

      .send-btn { width: 44px; height: 44px; }

    }

  `]

})

export class ChatComponent implements OnInit, OnDestroy {

  appName = APP_NAME;

  apiUrl = environment.apiUrl;

  currentRoom = signal<ChatRoomResponse | null>(null);

  messages = signal<MessageResponse[]>([]);

  newMessage = '';

  searchQuery = '';

  searchResults = signal<PublicUserProfile[]>([]);

  userStatuses = signal<Record<string, FriendStatusResponse>>({});

  recentFriends = computed(() => this.unread.overviewItems().slice(0, 5));

  typingUserId = signal<string | null>(null);

  isFriend = signal(false);

  friendRequestSent = signal(false);

  pendingReceived = signal(false);

  incomingRequestId = signal<string | null>(null);

  myId = computed(() => this.auth.user()?.id ?? '');

  totalUnread = this.unread.totalUnread;

  pendingRequests = this.friendNotification.pendingCount;

  pendingRequestCount = this.friendNotification.pendingCount;

  incomingPendingRequests = this.friendNotification.pendingRequests;

  friendsBadge = this.friendNotification.friendsBadge;

  private sub: Subscription | null = null;

  private typingSub: Subscription | null = null;

  private wsSub: Subscription | null = null;

  private friendReqSub: Subscription | null = null;

  private friendAcceptedSub: Subscription | null = null;

  private matchFoundSub: Subscription | null = null;

  private partnerSearchingSub: Subscription | null = null;

  private searchDialogRef: MatDialogRef<SearchPartnerDialogComponent> | null = null;



  constructor(

    public auth: AuthService,

    private chatApi: ChatApiService,

    private matchmakingApi: MatchmakingApiService,

    private ws: WebSocketService,

    private dialog: MatDialog,

    private friendApi: FriendApiService,

    private userApi: UserApiService,

    private blockApi: BlockApiService,

    private unread: UnreadCountService,

    private friendNotification: FriendNotificationService,

    private messageNotification: MessageNotificationService,

    private router: Router,

    private snackBar: MatSnackBar,

    private chatMessaging: ChatMessagingService

  ) {}



  ngOnInit(): void {

    this.ws.connect();

    this.friendNotification.startListening();

    this.loadRecentFriends();

    this.loadCurrentRoom();

    this.wsSub = this.ws.connected$.pipe(filter(Boolean), skip(1)).subscribe(() => {

      const room = this.currentRoom();

      if (room) this.subscribeToRoom(room.id);

    });

    this.friendReqSub = this.ws.subscribeFriendRequests().subscribe((req) => {

      const room = this.currentRoom();

      if (!room || req.sender.id !== room.participant.id || this.isFriend()) return;

      this.friendApi.areFriends(req.sender.id).subscribe(({ friends }) => {

        if (friends) return;

        this.pendingReceived.set(true);

        this.incomingRequestId.set(req.id);

        this.friendRequestSent.set(false);

        this.isFriend.set(false);

      });

    });

    this.friendAcceptedSub = this.ws.subscribeFriendAccepted().subscribe(({ friendId }) => {

      const room = this.currentRoom();

      if (!room || room.participant.id !== friendId) return;

      this.onFriendConfirmed();

    });

    const userId = this.auth.user()?.id;

    this.matchFoundSub = this.ws.subscribeUserMatchFound(userId).subscribe((room) => {

      if (this.isFriend()) return;

      this.clearCurrentMatchRoom();

      this.snackBar.open(`Matched with ${room.participant.username}!`, 'OK', { duration: 3000 });

      this.applyNewMatchRoom(room);

    });

    this.partnerSearchingSub = this.ws.subscribeUserPartnerSearching(userId).subscribe(() => {

      if (this.isFriend()) return;

      if (this.currentRoom()) this.clearCurrentMatchRoom();

      this.openSearchDialog({ searchingOnly: true });

    });

  }



  ngOnDestroy(): void {

    this.messageNotification.setActiveRoom(null);

    this.sub?.unsubscribe();

    this.typingSub?.unsubscribe();

    this.wsSub?.unsubscribe();

    this.friendReqSub?.unsubscribe();

    this.friendAcceptedSub?.unsubscribe();

    this.matchFoundSub?.unsubscribe();

    this.partnerSearchingSub?.unsubscribe();

  }



  initials(name: string): string {

    return (name || '?').slice(0, 2).toUpperCase();

  }



  imageSrc(url?: string | null): string {

    return mediaUrl(this.apiUrl, url);

  }



  messageUser(userId: string): void {

    this.chatApi.getFriendRoom(userId).subscribe({

      next: () => this.router.navigate(['/friends/chat', userId]),

      error: () => this.snackBar.open('Pehle Add Friend karein, phir message bhej sakte hain', 'OK', { duration: 4000 })

    });

  }



  userStatus(userId: string): FriendStatusResponse | undefined {

    return this.userStatuses()[userId];

  }



  addFriendFromSearch(userId: string): void {

    if (this.userStatus(userId)?.pendingSent) return;

    this.friendApi.sendRequest(userId).subscribe({

      next: () => {

        this.userStatuses.update((m) => ({

          ...m,

          [userId]: { friends: false, pendingSent: true, pendingReceived: false }

        }));

        this.snackBar.open('Friend request sent!', 'OK', { duration: 3000 });

      },

      error: (err) => {

        const msg = err.error?.error ?? '';

        if (msg.includes('already sent') || msg.includes('Already')) {

          this.userStatuses.update((m) => ({

            ...m,

            [userId]: { friends: false, pendingSent: true, pendingReceived: false }

          }));

        } else {

          this.snackBar.open(msg || 'Could not send request', 'OK', { duration: 4000 });

        }

      }

    });

  }



  confirmFriendFromSearch(userId: string): void {

    const status = this.userStatus(userId);

    const accept = (requestId: string) => {

      this.friendApi.accept(requestId).subscribe(() => {

        this.userStatuses.update((m) => ({

          ...m,

          [userId]: { friends: true, pendingSent: false, pendingReceived: false }

        }));

        this.friendNotification.onRequestHandled();

        this.snackBar.open('Friend confirmed!', 'OK', { duration: 3000 });

      });

    };

    if (status?.pendingReceivedRequestId) {

      accept(status.pendingReceivedRequestId);

      return;

    }

    this.friendApi.getPendingRequests().subscribe((reqs) => {

      const req = reqs.find((r) => r.sender.id === userId);

      if (req) accept(req.id);

    });

  }



  acceptHomeRequest(requestId: string): void {

    this.friendApi.accept(requestId).subscribe(() => {

      this.friendNotification.onRequestHandled();

      this.loadRecentFriends();

      this.snackBar.open('Friend confirmed!', 'OK', { duration: 3000 });

    });

  }



  rejectHomeRequest(requestId: string): void {

    this.friendApi.reject(requestId).subscribe(() => {

      this.friendNotification.onRequestHandled();

    });

  }



  searchUsers(): void {

    const q = this.searchQuery?.trim();

    if (!q) return;

    this.userApi.searchUsers(q).subscribe((r) => {

      this.searchResults.set(r);

      this.userStatuses.set({});

      r.forEach((u) => {

        this.friendApi.getRelationshipStatus(u.id).subscribe({

          next: (s) => this.userStatuses.update((m) => ({ ...m, [u.id]: s }))

        });

      });

    });

  }



  loadRecentFriends(): void {
    this.unread.refreshFromOverview();
  }



  loadCurrentRoom(): void {

    this.chatApi.getCurrentRoom().subscribe({

      next: (room) => {

        if (room) {

          this.currentRoom.set(room);

          this.loadHistory(room.id);

          this.subscribeToRoom(room.id);

          this.checkFriendStatus(room.participant.id);

        } else {

          this.currentRoom.set(null);

        }

      },

      error: () => this.currentRoom.set(null)

    });

  }



  loadHistory(roomId: string): void {

    const room = this.currentRoom();

    const friendId = room?.friendChat ? room.participant.id : undefined;

    void this.chatMessaging.loadRoomMessages(roomId, friendId).then((msgs) => {

      this.messages.update((current) => this.mergeMessageLists(current, msgs));

    });

  }



  private mergeMessageLists(...lists: MessageResponse[][]): MessageResponse[] {

    const byId = new Map<string, MessageResponse>();

    for (const list of lists) {

      for (const msg of list) {

        if (msg?.id) byId.set(String(msg.id).toLowerCase(), msg);

      }

    }

    return [...byId.values()].sort(

      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()

    );

  }



  isSentByMe(msg: MessageResponse): boolean {

    const mine = String(this.myId() || '').toLowerCase();

    return mine.length > 0 && String(msg.senderId || '').toLowerCase() === mine;

  }



  subscribeToRoom(roomId: string): void {

    this.sub?.unsubscribe();

    this.typingSub?.unsubscribe();

    this.messageNotification.setActiveRoom(roomId);

    this.sub = this.ws.subscribeToRoom(roomId).subscribe({

      next: (msg: ChatMessage) => {

        const room = this.currentRoom();

        void this.chatMessaging

          .persistIncoming(

            msg as MessageResponse,

            room?.friendChat ? room.participant.id : null,

            this.myId()!,

            this.unread.activeChatFriendId(),

            roomId

          )

          .then(() => this.appendMessage(msg as MessageResponse));

      },

      error: (err) => console.warn('Could not subscribe to room messages', err)

    });

    this.typingSub = this.ws.subscribeToTyping(roomId).subscribe({

      next: (e) => this.typingUserId.set(e.typing ? e.userId : null),

      error: (err) => console.warn('Could not subscribe to typing', err)

    });

  }



  private appendMessage(msg: MessageResponse): void {

    this.messages.update((m) =>

      m.some((x) => String(x.id).toLowerCase() === String(msg.id).toLowerCase()) ? m : [...m, msg]

    );

  }



  private checkFriendStatus(participantId: string): void {

    this.friendApi.getRelationshipStatus(participantId).subscribe({

      next: (s) => this.applyFriendStatus(s),

      error: () => this.loadFriendStatusFallback(participantId)

    });

  }



  private applyFriendStatus(s: FriendStatusResponse): void {

    this.isFriend.set(s.friends);

    this.friendRequestSent.set(s.pendingSent);

    this.pendingReceived.set(s.pendingReceived);

    this.incomingRequestId.set(s.pendingReceivedRequestId ?? null);

    if (s.friends) {

      this.currentRoom.update((r) => (r ? { ...r, friendChat: true } : r));

    }

  }



  private onFriendConfirmed(): void {

    this.isFriend.set(true);

    this.pendingReceived.set(false);

    this.friendRequestSent.set(false);

    this.incomingRequestId.set(null);

    this.friendNotification.onRequestHandled();

    this.loadRecentFriends();

    this.currentRoom.update((r) => (r ? { ...r, friendChat: true } : r));

  }



  private loadFriendStatusFallback(participantId: string): void {

    this.friendApi.getPendingRequests().subscribe({

      next: (requests) => {

        const incoming = requests.find((r) => r.sender.id === participantId);

        if (incoming) {

          this.pendingReceived.set(true);

          this.incomingRequestId.set(incoming.id);

          this.friendRequestSent.set(false);

          this.isFriend.set(false);

          return;

        }

        this.friendApi.getPendingSent().subscribe({

          next: (sent) => {

            const outgoing = sent.find((r) => r.receiver.id === participantId);

            if (outgoing) {

              this.friendRequestSent.set(true);

              this.pendingReceived.set(false);

              this.isFriend.set(false);

              return;

            }

            this.friendApi.getFriends().subscribe({

              next: (friends) => this.isFriend.set(friends.some((f) => f.id === participantId))

            });

          }

        });

      }

    });

  }



  acceptIncomingRequest(): void {

    const requestId = this.incomingRequestId();

    const room = this.currentRoom();

    if (!room) return;

    const accept = (id: string) => {

      this.friendApi.accept(id).subscribe(() => this.onFriendConfirmed());

    };

    if (requestId) { accept(requestId); return; }

    this.friendApi.getPendingRequests().subscribe((requests) => {

      const req = requests.find((r) => r.sender.id === room.participant.id);

      if (req) accept(req.id);

    });

  }



  rejectIncomingRequest(): void {

    const requestId = this.incomingRequestId();

    const room = this.currentRoom();

    if (!room) return;

    const reject = (id: string) => {

      this.friendApi.reject(id).subscribe(() => {

        this.pendingReceived.set(false);

        this.incomingRequestId.set(null);

      });

    };

    if (requestId) { reject(requestId); return; }

    this.friendApi.getPendingRequests().subscribe((requests) => {

      const req = requests.find((r) => r.sender.id === room.participant.id);

      if (req) reject(req.id);

    });

  }



  addFriend(): void {

    const room = this.currentRoom();

    if (!room || this.friendRequestSent() || this.pendingReceived() || this.isFriend()) return;

    this.friendApi.sendRequest(room.participant.id).subscribe({

      next: () => {

        this.friendApi.getRelationshipStatus(room.participant.id).subscribe((s) => {

          if (s.friends) {

            this.onFriendConfirmed();

          } else {

            this.applyFriendStatus(s);

            this.friendRequestSent.set(true);

          }

        });

      },

      error: (err) => {

        const msg = err.error?.error ?? '';

        if (msg.includes('Already friends')) {

          this.onFriendConfirmed();

        } else {

          this.checkFriendStatus(room.participant.id);

        }

      }

    });

  }



  blockPartner(): void {

    const room = this.currentRoom();

    if (!room || !confirm(`Block ${room.participant.username}?`)) return;

    this.blockApi.blockUser(room.participant.id).subscribe(() => {

      this.chatApi.nextPartner(room.id).subscribe(() => {

        this.currentRoom.set(null);

        this.messages.set([]);

        this.openSearchDialog();

      });

    });

  }



  send(): void {

    const room = this.currentRoom();

    const content = this.newMessage?.trim();

    if (!room || !content || !this.myId()) return;

    const friendId = room.friendChat ? room.participant.id : undefined;

    this.newMessage = '';

    this.chatMessaging.sendText(room, this.myId()!, content, friendId).subscribe({

      next: (msg) => this.appendMessage(msg),

      error: (apiErr) => {

        console.warn('Could not send message', apiErr);

        this.newMessage = content;

      }

    });

  }



  onImageSelected(event: Event): void {

    const room = this.currentRoom();

    const file = (event.target as HTMLInputElement).files?.[0];

    if (!room || !file || !this.myId()) return;

    this.chatApi.uploadImage(file).subscribe({

      next: ({ url }) => {

        this.chatMessaging.sendImage(room, this.myId()!, url, room.friendChat ? room.participant.id : undefined).subscribe({

          next: (msg) => this.appendMessage(msg),

          error: (err) => console.warn('Could not send image', err)

        });

      },

      error: (err) => console.warn('Could not upload image', err)

    });

    (event.target as HTMLInputElement).value = '';

  }



  nextPartner(): void {

    const room = this.currentRoom();

    if (!room || this.isFriend()) return;

    this.chatApi.nextPartner(room.id).subscribe((res) => {

      this.clearCurrentMatchRoom();

      if (res.room) {

        this.applyNewMatchRoom(res.room);

      } else {

        this.openSearchDialog({ searchingOnly: true });

      }

    });

  }



  private applyNewMatchRoom(room: ChatRoomResponse): void {

    if (this.searchDialogRef) {

      this.searchDialogRef.close(null);

      this.searchDialogRef = null;

    }

    this.currentRoom.set(room);

    this.loadHistory(room.id);

    this.subscribeToRoom(room.id);

    this.checkFriendStatus(room.participant.id);

  }



  private clearCurrentMatchRoom(): void {

    this.currentRoom.set(null);

    this.messages.set([]);

    this.isFriend.set(false);

    this.friendRequestSent.set(false);

    this.pendingReceived.set(false);

    this.incomingRequestId.set(null);

    this.sub?.unsubscribe();

    this.typingSub?.unsubscribe();

    this.loadRecentFriends();

  }



  openSearchDialog(opts?: { autoSearch?: boolean; searchingOnly?: boolean }): void {

    if (this.searchDialogRef) return;

    const stored = sessionStorage.getItem('matchPreference');

    const preference = stored === 'MALE' || stored === 'FEMALE' ? stored : 'FEMALE';

    const data: SearchPartnerDialogData = {

      autoSearch: opts?.autoSearch ?? false,

      searchingOnly: opts?.searchingOnly ?? false,

      preference

    };

    this.searchDialogRef = this.dialog.open(SearchPartnerDialogComponent, { width: '320px', data });

    this.searchDialogRef.afterClosed().subscribe((room) => {

      this.searchDialogRef = null;

      if (room) {

        this.currentRoom.set(room);

        this.loadHistory(room.id);

        this.subscribeToRoom(room.id);

        this.checkFriendStatus(room.participant.id);

      }

    });

  }

}


