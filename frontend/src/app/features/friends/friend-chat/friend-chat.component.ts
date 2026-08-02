import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';

import { MatButtonModule } from '@angular/material/button';

import { MatFormFieldModule } from '@angular/material/form-field';

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



@Component({

  selector: 'app-friend-chat',

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

            <div class="avatar">{{ initials(currentRoom()!.participant.username) }}</div>

            <div class="header-info">

              <a class="name" [routerLink]="['/profile', currentRoom()!.participant.id]">{{ currentRoom()!.participant.username }}</a>

              <span class="status" [class.online]="currentRoom()!.participant.onlineStatus">

                {{ currentRoom()!.participant.onlineStatus ? 'Online' : 'Offline' }}

              </span>

            </div>

            <button mat-icon-button class="call-btn" (click)="startCall()" title="Voice call"><mat-icon>call</mat-icon></button>

            <button mat-icon-button [matMenuTriggerFor]="chatMenu"><mat-icon>more_vert</mat-icon></button>

            <mat-menu #chatMenu="matMenu">

              <a mat-menu-item [routerLink]="['/profile', currentRoom()!.participant.id]"><mat-icon>person</mat-icon> View Profile</a>

              <button mat-menu-item (click)="removeFriend()"><mat-icon>person_remove</mat-icon> Remove Friend</button>

              <button mat-menu-item (click)="blockFriend()"><mat-icon>block</mat-icon> Block</button>

            </mat-menu>

          </header>



          <div class="messages-container" #scrollArea>

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

                <div class="message-row" [class.sent]="msg.senderId === myId()">

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

            <input #imageInput type="file" accept="image/*" hidden (change)="onImageSelected($event)" />

            <button mat-icon-button type="button" class="attach-btn" (click)="imageInput.click()" title="Attach image">

              <mat-icon>photo_camera</mat-icon>

            </button>

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

    .chat-page {

      min-height: calc(100vh - 64px);

      background: linear-gradient(180deg, #eef1fb 0%, #f7f8fc 40%);

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

      max-width: 820px;

      margin: 0 auto;

      height: calc(100vh - 96px);

      display: flex;

      flex-direction: column;

      background: #fff;

      border-radius: 20px;

      overflow: hidden;

      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.12);

      border: 1px solid rgba(0, 0, 0, 0.05);

    }



    .chat-header {

      display: flex;

      align-items: center;

      gap: 12px;

      padding: 14px 16px;

      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

      color: #fff;

    }



    .back-btn {

      color: #fff !important;

    }



    .avatar {

      width: 42px;

      height: 42px;

      border-radius: 50%;

      background: rgba(255, 255, 255, 0.25);

      display: flex;

      align-items: center;

      justify-content: center;

      font-weight: 700;

      font-size: 0.95rem;

    }



    .header-info {

      display: flex;

      flex-direction: column;

      gap: 2px;

    }



    .header-info { flex: 1; }

    .name {

      font-weight: 600;

      font-size: 1.05rem;

      color: #fff;

      text-decoration: none;

    }

    .name:hover { text-decoration: underline; }



    .status {

      font-size: 0.8rem;

      opacity: 0.85;

    }



    .status.online {

      opacity: 1;

    }



    .status.online::before {

      content: '● ';

      color: #a5f3a5;

    }



    .messages-container {

      flex: 1;

      overflow-y: auto;

      padding: 20px 16px;

      background: #f8f9fd;

    }



    .message-row {

      display: flex;

      margin-bottom: 10px;

    }



    .message-row.sent {

      justify-content: flex-end;

    }



    .bubble {

      max-width: 75%;

      padding: 10px 14px;

      border-radius: 16px;

      background: #fff;

      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);

    }



    .message-row.sent .bubble {

      background: linear-gradient(135deg, #667eea, #764ba2);

      color: #fff;

      border-bottom-right-radius: 4px;

    }



    .message-row:not(.sent) .bubble {

      border-bottom-left-radius: 4px;

    }



    .content {

      display: block;

      word-break: break-word;

      line-height: 1.45;

    }



    .time {

      font-size: 0.7rem;

      opacity: 0.75;

      display: block;

      margin-top: 4px;

      text-align: right;

    }



    .chat-image {

      max-width: 240px;

      max-height: 240px;

      border-radius: 10px;

      display: block;

      margin-bottom: 4px;

    }



    .composer {

      display: flex;

      align-items: center;

      gap: 8px;

      padding: 12px 16px 16px;

      background: #fff;

      border-top: 1px solid #eee;

    }



    .message-input {

      flex: 1;

      margin: 0;

    }



    .attach-btn {

      color: #667eea;

    }



    .send-btn {

      width: 48px;

      height: 48px;

      box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);

    }



    .send-btn mat-icon {

      margin-left: 2px;

    }

    .call-log-row {

      display: flex;

      justify-content: center;

      margin: 12px 0;

    }

    .call-log-bubble {

      display: inline-flex;

      align-items: center;

      gap: 8px;

      padding: 8px 14px;

      border-radius: 999px;

      background: #eef1fb;

      color: #555;

      font-size: 0.85rem;

      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);

    }

    .call-log-bubble mat-icon {

      font-size: 18px;

      width: 18px;

      height: 18px;

      color: #667eea;

    }

    .call-time {

      font-size: 0.72rem;

      opacity: 0.75;

      margin-left: 4px;

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

      .chat-image { max-width: min(240px, 70vw); max-height: min(240px, 50vh); }

      .composer { padding: 8px 10px max(12px, env(safe-area-inset-bottom)); gap: 4px; }

      .send-btn { width: 44px; height: 44px; }

    }

  `]

})

export class FriendChatComponent implements OnInit, OnDestroy {

  apiUrl = environment.apiUrl;

  currentRoom = signal<ChatRoomResponse | null>(null);

  messages = signal<MessageResponse[]>([]);

  newMessage = '';

  myId = computed(() => this.auth.user()?.id ?? '');

  private sub: Subscription | null = null;

  private wsSub: Subscription | null = null;

  private friendId = '';



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

    private callService: CallService,

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

    void this.chatMessaging.loadRoomMessages(roomId, this.friendId).then((msgs) => this.messages.set(msgs));

  }



  private subscribeToRoom(roomId: string): void {

    this.sub?.unsubscribe();

    this.messageNotification.setActiveRoom(roomId);

    this.sub = this.ws.subscribeToRoom(roomId).subscribe({

      next: (msg: ChatMessage) => {

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

      m.some((x) => String(x.id).toLowerCase() === String(msg.id).toLowerCase()) ? m : [...m, msg]

    );

  }



  send(): void {

    const room = this.currentRoom();

    const content = this.newMessage?.trim();

    if (!room || !content || !this.myId()) return;

    this.newMessage = '';

    this.chatMessaging

      .sendText(room, this.myId()!, content, room.participant.id)

      .subscribe({

        next: (msg) => this.appendMessage(msg),

        error: (err) => {

          console.warn('Could not send message', err);

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


