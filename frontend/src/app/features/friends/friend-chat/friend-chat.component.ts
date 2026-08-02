import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';

import { MatButtonModule } from '@angular/material/button';

import { MatInputModule } from '@angular/material/input';

import { MatIconModule } from '@angular/material/icon';

import { MatMenuModule } from '@angular/material/menu';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../core/services/auth.service';

import { ChatApiService, ChatRoomResponse, MessageResponse } from '../../../core/services/chat-api.service';

import { WebSocketService, ChatMessage } from '../../../core/services/websocket.service';

import { UnreadCountService } from '../../../core/services/unread-count.service';

import { MessageNotificationService } from '../../../core/services/message-notification.service';

import { FriendApiService } from '../../../core/services/friend-api.service';

import { BlockApiService } from '../../../core/services/block-api.service';

import { Subscription, filter, skip } from 'rxjs';

import { environment } from '../../../../environments/environment';

import { mediaUrl } from '../../../core/utils/media-url';

import { CallService } from '../../../core/services/call.service';

import { ChatMessagingService } from '../../../core/services/chat-messaging.service';

import { LocalMessageStoreService } from '../../../core/services/local-message-store.service';

import { formatLiveCallTimer } from '../../../core/utils/call-log.helper';

import { isDuplicateMessage } from '../../../core/utils/message-dedup.helper';

import { scrollToBottom } from '../../../core/utils/chat-scroll.helper';



@Component({

  selector: 'app-friend-chat',

  standalone: true,

  imports: [

    CommonModule,

    FormsModule,

    RouterLink,

    MatCardModule,

    MatButtonModule,

    MatInputModule,

    MatIconModule,

    MatMenuModule,

    MatSnackBarModule

  ],

  template: `

    <div class="chat-page">

      @if (!currentRoom()) {

        <div class="loading">

          <mat-icon>hourglass_empty</mat-icon>

          <p>Loading chat...</p>

        </div>

      } @else {

        <div class="chat-shell">

          <header class="chat-header">

            <button mat-icon-button routerLink="/friends" class="back-btn" aria-label="Back">

              <mat-icon>arrow_back</mat-icon>

            </button>

            <div class="avatar-wrap">

              <div class="avatar" [class.online-ring]="currentRoom()!.participant.onlineStatus">{{ initials(currentRoom()!.participant.username) }}</div>

            </div>

            <div class="header-info">

              <a class="name" [routerLink]="['/profile', currentRoom()!.participant.id]">{{ currentRoom()!.participant.username }}</a>

              <span class="status" [class.online]="currentRoom()!.participant.onlineStatus">

                {{ currentRoom()!.participant.onlineStatus ? 'Online' : 'Offline' }}

              </span>

            </div>

            <button mat-icon-button class="call-btn" (click)="startCall()" title="Voice call" [class.calling]="activeCallWithFriend()">

              <mat-icon>{{ activeCallWithFriend() ? 'call' : 'call' }}</mat-icon>

            </button>

            <button mat-icon-button class="menu-btn" [matMenuTriggerFor]="chatMenu"><mat-icon>more_vert</mat-icon></button>

            <mat-menu #chatMenu="matMenu">

              <a mat-menu-item [routerLink]="['/profile', currentRoom()!.participant.id]"><mat-icon>person</mat-icon> View Profile</a>

              <button mat-menu-item (click)="removeFriend()"><mat-icon>person_remove</mat-icon> Remove Friend</button>

              <button mat-menu-item (click)="blockFriend()"><mat-icon>block</mat-icon> Block</button>

            </mat-menu>

          </header>



          @if (activeCallWithFriend()) {

            <div class="call-live-bar" [class.ringing]="callService.state() !== 'active'">

              <span class="live-dot"></span>

              <mat-icon>call</mat-icon>

              <span class="live-label">

                {{ callService.state() === 'active' ? 'On call' : 'Calling...' }}

              </span>

              @if (callService.state() === 'active') {

                <span class="live-timer">{{ liveCallTimer() }}</span>

              }

              <button mat-stroked-button class="end-mini" (click)="hangUpCall()">End</button>

            </div>

          }



          <div class="messages-container" #scrollArea>

            @for (msg of messages(); track msg.id) {

              @if (msg.messageType === 'CALL') {

                <div class="call-log-row">

                  <div class="call-log-bubble" [class.missed]="isMissedCall(msg)">

                    <mat-icon>{{ isMissedCall(msg) ? 'phone_missed' : 'phone_in_talk' }}</mat-icon>

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

          </div>



          <footer class="composer">

            <div class="composer-card">

              <input #imageInput type="file" accept="image/*" hidden (change)="onImageSelected($event)" />

              <button mat-icon-button type="button" class="attach-btn" (click)="imageInput.click()" title="Attach image">

                <mat-icon>add_photo_alternate</mat-icon>

              </button>

              <div class="input-pill">

                <input
                  #messageInput
                  class="message-field"
                  [(ngModel)]="newMessage"
                  (keydown.enter)="$event.preventDefault(); send()"
                  placeholder="Message..."
                  autocomplete="off"
                />

              </div>

              <button
                type="button"
                class="send-btn"
                (mousedown)="keepComposerFocus($event)"
                (click)="send()"
                [disabled]="!newMessage.trim()"
                aria-label="Send message"
              >

                <mat-icon>send</mat-icon>

              </button>

            </div>

          </footer>

        </div>

      }

    </div>

  `,

  styles: [`

    .chat-page {

      min-height: calc(100vh - 64px);

      background: linear-gradient(165deg, #e8ecff 0%, #f4f6fc 45%, #fafbff 100%);

      padding: 16px;

    }



    .loading {

      text-align: center;

      padding: 48px;

      color: #888;

    }



    .loading mat-icon {

      font-size: 40px;

      width: 40px;

      height: 40px;

      margin-bottom: 8px;

    }



    .chat-shell {

      max-width: 860px;

      margin: 0 auto;

      height: calc(100vh - 96px);

      display: flex;

      flex-direction: column;

      background: #fff;

      border-radius: 24px;

      overflow: hidden;

      box-shadow: 0 20px 50px rgba(79, 98, 196, 0.14);

      border: 1px solid rgba(255, 255, 255, 0.8);

    }



    .chat-header {

      display: flex;

      align-items: center;

      gap: 10px;

      padding: 14px 18px;

      background: linear-gradient(120deg, #5c6fd6 0%, #7b5eb8 55%, #8b5cf6 100%);

      color: #fff;

      box-shadow: 0 4px 20px rgba(92, 111, 214, 0.25);

    }



    .back-btn, .call-btn, .menu-btn { color: #fff !important; }

    .call-btn.calling { animation: callPulse 1.4s ease-in-out infinite; }



    .avatar-wrap { flex-shrink: 0; }

    .avatar {

      width: 44px;

      height: 44px;

      border-radius: 50%;

      background: rgba(255, 255, 255, 0.22);

      display: flex;

      align-items: center;

      justify-content: center;

      font-weight: 700;

      font-size: 0.92rem;

      letter-spacing: 0.02em;

    }

    .avatar.online-ring { box-shadow: 0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(165, 243, 165, 0.55); }



    .header-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

    .name {

      font-weight: 700;

      font-size: 1.06rem;

      color: #fff;

      text-decoration: none;

      white-space: nowrap;

      overflow: hidden;

      text-overflow: ellipsis;

    }

    .name:hover { text-decoration: underline; }



    .status { font-size: 0.78rem; opacity: 0.88; }

    .status.online { opacity: 1; }

    .status.online::before { content: '● '; color: #b9ffb9; }



    .call-live-bar {

      display: flex;

      align-items: center;

      gap: 8px;

      padding: 10px 16px;

      background: linear-gradient(90deg, #e8f5e9, #f1f8e9);

      border-bottom: 1px solid rgba(46, 125, 50, 0.15);

      color: #2e7d32;

      font-size: 0.88rem;

      font-weight: 600;

    }

    .call-live-bar.ringing { background: linear-gradient(90deg, #fff8e1, #fff3e0); color: #e65100; }

    .call-live-bar mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .live-dot {

      width: 8px; height: 8px; border-radius: 50%;

      background: #43a047;

      animation: liveBlink 1.2s ease-in-out infinite;

    }

    .call-live-bar.ringing .live-dot { background: #fb8c00; }

    .live-timer {

      font-variant-numeric: tabular-nums;

      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;

      background: rgba(255,255,255,0.7);

      padding: 2px 10px;

      border-radius: 999px;

      margin-left: 4px;

    }

    .end-mini {

      margin-left: auto !important;

      min-height: 32px !important;

      line-height: 32px !important;

      padding: 0 12px !important;

      font-size: 0.78rem !important;

      border-radius: 999px !important;

    }



    .messages-container {

      flex: 1;

      overflow-y: auto;

      padding: 20px 18px 12px;

      background:

        radial-gradient(circle at 20% 10%, rgba(102, 126, 234, 0.06) 0%, transparent 45%),

        radial-gradient(circle at 80% 90%, rgba(118, 75, 162, 0.05) 0%, transparent 40%),

        #f6f8fd;

      scroll-behavior: auto;

      overflow-anchor: auto;

    }



    .message-row { display: flex; margin-bottom: 8px; animation: msgIn 0.22s ease-out; }

    .message-row.sent { justify-content: flex-end; }



    .bubble {

      max-width: min(78%, 520px);

      padding: 11px 14px 8px;

      border-radius: 18px;

      background: #fff;

      box-shadow: 0 2px 10px rgba(30, 41, 80, 0.07);

      border: 1px solid rgba(0, 0, 0, 0.04);

    }



    .message-row.sent .bubble {

      background: linear-gradient(135deg, #667eea 0%, #7c6cf0 50%, #764ba2 100%);

      color: #fff;

      border-bottom-right-radius: 6px;

      border: none;

      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35);

    }



    .message-row:not(.sent) .bubble { border-bottom-left-radius: 6px; }



    .content { display: block; word-break: break-word; line-height: 1.5; font-size: 0.95rem; }



    .time {

      font-size: 0.68rem;

      opacity: 0.72;

      display: block;

      margin-top: 6px;

      text-align: right;

      letter-spacing: 0.02em;

    }



    .chat-image {

      max-width: 260px;

      max-height: 260px;

      border-radius: 12px;

      display: block;

      margin-bottom: 6px;

      object-fit: cover;

    }



    .composer {

      padding: 12px 14px max(14px, env(safe-area-inset-bottom));

      background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, #fff 100%);

      border-top: 1px solid rgba(0, 0, 0, 0.06);

    }



    .composer-card {

      display: flex;

      align-items: flex-end;

      gap: 6px;

      padding: 8px 10px;

      border-radius: 28px;

      background: #f3f5fb;

      border: 1px solid rgba(102, 126, 234, 0.12);

      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 18px rgba(79, 98, 196, 0.08);

    }



    .attach-btn { color: #667eea !important; flex-shrink: 0; }



    .input-pill { flex: 1; min-width: 0; }



    .message-field {

      width: 100%;

      border: none;

      outline: none;

      background: transparent;

      font-size: 0.96rem;

      line-height: 1.45;

      padding: 8px 4px;

      color: #1a1f36;

      font-family: inherit;

    }

    .message-field::placeholder { color: #9aa3b8; }



    .send-btn {

      width: 44px;

      height: 44px;

      border: none;

      border-radius: 50%;

      flex-shrink: 0;

      display: flex;

      align-items: center;

      justify-content: center;

      cursor: pointer;

      background: linear-gradient(135deg, #667eea, #764ba2);

      color: #fff;

      box-shadow: 0 6px 18px rgba(102, 126, 234, 0.45);

      transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s;

    }

    .send-btn:not(:disabled):hover { transform: scale(1.05); box-shadow: 0 8px 22px rgba(102, 126, 234, 0.5); }

    .send-btn:disabled { opacity: 0.45; cursor: default; box-shadow: none; }

    .send-btn mat-icon { font-size: 20px; width: 20px; height: 20px; margin-left: 2px; }



    .call-log-row { display: flex; justify-content: center; margin: 14px 0; }

    .call-log-bubble {

      display: inline-flex;

      align-items: center;

      gap: 8px;

      padding: 9px 16px;

      border-radius: 999px;

      background: #fff;

      color: #5c6370;

      font-size: 0.84rem;

      box-shadow: 0 2px 10px rgba(30, 41, 80, 0.08);

      border: 1px solid rgba(102, 126, 234, 0.1);

    }

    .call-log-bubble.missed { color: #c62828; border-color: rgba(198, 40, 40, 0.15); background: #fff5f5; }

    .call-log-bubble mat-icon { font-size: 18px; width: 18px; height: 18px; color: #667eea; }

    .call-log-bubble.missed mat-icon { color: #e53935; }

    .call-time { font-size: 0.72rem; opacity: 0.7; margin-left: 2px; }



    @keyframes msgIn {

      from { opacity: 0; transform: translateY(6px); }

      to { opacity: 1; transform: translateY(0); }

    }

    @keyframes liveBlink {

      0%, 100% { opacity: 1; transform: scale(1); }

      50% { opacity: 0.5; transform: scale(0.85); }

    }

    @keyframes callPulse {

      0%, 100% { transform: scale(1); }

      50% { transform: scale(1.08); }

    }



    @media (max-width: 768px) {

      .chat-page {

        min-height: calc(100dvh - 56px);

        padding: 0;

        background: #fff;

      }

      .chat-shell {

        max-width: none;

        height: calc(100dvh - 56px);

        border-radius: 0;

        box-shadow: none;

        border: none;

      }

      .chat-header { padding: 10px 12px; gap: 8px; }

      .header-info .name { font-size: 0.95rem; }

      .bubble { max-width: 88%; }

      .chat-image { max-width: min(260px, 72vw); max-height: min(260px, 50vh); }

      .composer { padding: 8px 10px max(12px, env(safe-area-inset-bottom)); }

      .composer-card { padding: 6px 8px; border-radius: 24px; }

      .send-btn { width: 40px; height: 40px; }

    }

  `]

})

export class FriendChatComponent implements OnInit, OnDestroy {

  apiUrl = environment.apiUrl;

  currentRoom = signal<ChatRoomResponse | null>(null);

  messages = signal<MessageResponse[]>([]);

  newMessage = '';

  myId = computed(() => this.auth.user()?.id ?? '');

  activeCallWithFriend = computed(() => {

    const room = this.currentRoom();

    const state = this.callService.state();

    const remoteId = this.callService.remoteUserId();

    if (!room || !remoteId) return false;

    const onCall = state === 'active' || state === 'outgoing';

    return onCall && remoteId === room.participant.id;

  });

  liveCallTimer = computed(() => formatLiveCallTimer(this.callService.callDurationSeconds()));

  private sub: Subscription | null = null;

  private wsSub: Subscription | null = null;

  private friendId = '';

  @ViewChild('messageInput') private messageInput?: ElementRef<HTMLInputElement>;

  @ViewChild('scrollArea') private scrollArea?: ElementRef<HTMLElement>;



  constructor(

    private route: ActivatedRoute,

    private router: Router,

    public auth: AuthService,

    private chatApi: ChatApiService,

    private ws: WebSocketService,

    private unread: UnreadCountService,

    private messageNotification: MessageNotificationService,

    private friendApi: FriendApiService,

    private blockApi: BlockApiService,

    private snackBar: MatSnackBar,

    public callService: CallService,

    private chatMessaging: ChatMessagingService,

    private localStore: LocalMessageStoreService

  ) {}



  ngOnInit(): void {

    this.ws.connect();

    this.friendId = this.route.snapshot.paramMap.get('friendId') ?? '';

    this.unread.setActiveChat(this.friendId);

    this.openFriendChat();

    this.wsSub = this.ws.connected$.pipe(filter(Boolean), skip(1)).subscribe(() => {

      const room = this.currentRoom();

      if (room) this.subscribeToRoom(room.id);

    });

  }



  ngOnDestroy(): void {

    this.unread.setActiveChat(null);

    this.messageNotification.setActiveRoom(null);

    this.sub?.unsubscribe();

    this.wsSub?.unsubscribe();

  }



  initials(name: string): string {

    return (name || '?').slice(0, 2).toUpperCase();

  }



  imageSrc(url?: string | null): string {

    return mediaUrl(this.apiUrl, url);

  }



  startCall(): void {

    const room = this.currentRoom();

    if (!room) return;

    void this.callService.startCall(room.participant.id, room.participant.username);

  }



  hangUpCall(): void {

    this.callService.hangUp();

  }



  isMissedCall(msg: MessageResponse): boolean {

    const text = (msg.content ?? '').toLowerCase();

    return text.includes('missed') || text.includes('declined');

  }



  private openFriendChat(): void {

    this.chatApi.getFriendRoom(this.friendId).subscribe({

      next: (room) => {

        this.currentRoom.set(room);

        this.loadHistory(room.id);

        this.subscribeToRoom(room.id);

        this.unread.markFriendRead(this.friendId, room.id);

      },

      error: () => this.currentRoom.set(null)

    });

  }



  private loadHistory(roomId: string): void {

    void this.chatMessaging.loadRoomMessages(roomId, this.friendId).then((msgs) => {

      this.messages.update((current) => this.mergeMessageLists(current, msgs));

      this.scrollToLatest();

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



  private subscribeToRoom(roomId: string): void {

    this.sub?.unsubscribe();

    this.messageNotification.setActiveRoom(roomId);

    this.sub = this.ws.subscribeToRoom(roomId).subscribe({

      next: (msg: ChatMessage) => {

        if (this.isSentByMe(msg as MessageResponse)) {

          return;

        }

        void this.chatMessaging.persistIncoming(msg as MessageResponse, this.friendId, this.myId()!, this.friendId, roomId).then(() => {

          this.appendMessage(msg as MessageResponse);

        });

        if (msg.senderId !== this.myId()) {

          this.unread.markFriendRead(this.friendId, roomId);

        }

      }

    });

  }



  private appendMessage(msg: MessageResponse): void {

    this.messages.update((m) =>

      m.some((x) => isDuplicateMessage(x, msg)) ? m : [...m, msg]

    );

    this.scrollToLatest();

  }



  private scrollToLatest(): void {

    scrollToBottom(this.scrollArea?.nativeElement);

    setTimeout(() => scrollToBottom(this.scrollArea?.nativeElement), 50);

  }



  send(): void {

    const room = this.currentRoom();

    const content = this.newMessage?.trim();

    if (!room || !content || !this.myId()) return;

    this.newMessage = '';

    this.chatMessaging

      .sendText(room, this.myId()!, content, room.participant.id)

      .subscribe({

        next: (msg) => {

          this.appendMessage(msg);

          this.refocusComposer();

        },

        error: (err) => {

          console.warn('Could not send message', err);

          this.newMessage = content;

          this.refocusComposer();

        }

      });

  }



  keepComposerFocus(event: Event): void {

    event.preventDefault();

  }



  private refocusComposer(): void {

    setTimeout(() => this.messageInput?.nativeElement?.focus(), 0);

  }



  onImageSelected(event: Event): void {

    const room = this.currentRoom();

    const file = (event.target as HTMLInputElement).files?.[0];

    if (!room || !file || !this.myId()) return;

    this.chatApi.uploadImage(file).subscribe({

      next: ({ url }) => {

        this.chatMessaging.sendImage(room, this.myId()!, url, room.participant.id).subscribe({

          next: (msg) => this.appendMessage(msg),

          error: (err) => console.warn('Could not send image', err)

        });

      },

      error: (err) => console.warn('Could not upload image', err)

    });

    (event.target as HTMLInputElement).value = '';

  }



  removeFriend(): void {

    const room = this.currentRoom();

    if (!room || !confirm(`Remove ${room.participant.username} from friends? Chat history will be deleted.`)) return;

    this.friendApi.removeFriend(this.friendId).subscribe(() => {

      if (room.id) void this.localStore.deleteRoom(room.id, this.friendId);

      this.unread.refreshFromOverview();

      this.snackBar.open('Friend removed', 'OK', { duration: 3000 });

      this.router.navigate(['/friends']);

    });

  }



  blockFriend(): void {

    const room = this.currentRoom();

    if (!room || !confirm(`Block ${room.participant.username}?`)) return;

    this.blockApi.blockUser(this.friendId).subscribe(() => {

      this.snackBar.open('User blocked', 'OK', { duration: 3000 });

      this.router.navigate(['/friends']);

    });

  }

}


