import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable, Subject, filter, map, take, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ChatRoomResponse } from './chat-api.service';
import { fixSdpString } from '../utils/call-sdp.helper';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  chatRoomId: string;
  content: string;
  messageType?: 'TEXT' | 'IMAGE';
  imageUrl?: string;
  status: string;
  timestamp: string;
}

export interface IncomingFriendRequest {
  id: string;
  sender: { id: string; username: string };
  receiver: { id: string; username: string };
  status: string;
  createdAt: string;
}

export interface IncomingFriendMessage {
  roomId: string;
  senderId: string;
  senderUsername?: string;
  messageId: string;
  preview: string;
  timestamp: string;
  roomType?: 'FRIEND' | 'MATCHMAKING';
}

export interface CallSignal {
  type: 'offer' | 'answer' | 'ice' | 'hangup' | 'reject';
  fromUserId: string;
  fromUsername?: string;
  toUserId: string;
  callId: string;
  sentAt?: number;
  livekit?: boolean;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface PartnerLeftEvent {
  roomId: string;
  leaverUsername: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private client: Client | null = null;
  private connected = new BehaviorSubject<boolean>(false);
  private token: string | null = null;
  private friendRequests = new Subject<IncomingFriendRequest>();
  private friendMessages = new Subject<IncomingFriendMessage>();
  private callSignals = new Subject<CallSignal>();
  private friendAccepted = new Subject<{ friendId: string; friendUsername: string }>();
  private partnerLeft = new Subject<PartnerLeftEvent>();
  private matchFound = new Subject<ChatRoomResponse>();
  private partnerSearching = new Subject<void>();
  private friendRequestsSubscribed = false;
  private friendMessagesSubscribed = false;
  private callsSubscribed = false;
  private friendAcceptedSubscribed = false;
  private partnerLeftSubscribed = false;
  private matchFoundSubscribed = false;
  private partnerSearchingSubscribed = false;
  private userFriendRequestTopics = new Set<string>();
  private userFriendRequestUserId: string | null = null;
  private userPartnerLeftTopics = new Set<string>();
  private userPartnerLeftUserId: string | null = null;
  private userMatchFoundTopics = new Set<string>();
  private userMatchFoundUserId: string | null = null;
  private userPartnerSearchingTopics = new Set<string>();
  private userPartnerSearchingUserId: string | null = null;
  private userCallTopics = new Set<string>();
  private userCallsUserId: string | null = null;
  private roomChannels = new Map<
    string,
    { subject: Subject<ChatMessage>; stompSub: StompSubscription | null }
  >();
  private typingChannels = new Map<
    string,
    { subject: Subject<{ userId: string; typing: boolean }>; stompSub: StompSubscription | null }
  >();

  connected$ = this.connected.asObservable();
  friendRequest$ = this.friendRequests.asObservable();
  friendMessage$ = this.friendMessages.asObservable();
  callSignal$ = this.callSignals.asObservable();
  friendAccepted$ = this.friendAccepted.asObservable();
  partnerLeft$ = this.partnerLeft.asObservable();
  matchFound$ = this.matchFound.asObservable();
  partnerSearching$ = this.partnerSearching.asObservable();

  constructor(private auth: AuthService) {}

  connect(): void {
    this.token = this.auth.getAccessToken();
    if (!this.token) return;
    if (this.client?.connected) return;

    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connected.next(false);
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws?token=${this.token}`),
      connectHeaders: { Authorization: `Bearer ${this.token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.connected.next(true);
        // STOMP auto-reconnect drops subscriptions — always re-subscribe.
        this.friendRequestsSubscribed = false;
        this.friendMessagesSubscribed = false;
        this.callsSubscribed = false;
        this.friendAcceptedSubscribed = false;
        this.partnerLeftSubscribed = false;
        this.matchFoundSubscribed = false;
        this.partnerSearchingSubscribed = false;
        this.userFriendRequestTopics.clear();
        this.userPartnerLeftTopics.clear();
        this.userMatchFoundTopics.clear();
        this.userPartnerSearchingTopics.clear();
        this.userCallTopics.clear();
        this.resetRoomSubscriptions();
        this.subscribeFriendRequestsInternal();
        this.subscribeFriendMessagesInternal();
        this.subscribeCallsInternal();
        this.resubscribeAllRooms();
        if (this.userFriendRequestUserId) {
          this.subscribeUserFriendRequestsInternal(this.userFriendRequestUserId);
        }
        if (this.userPartnerLeftUserId) {
          this.subscribeUserPartnerLeftInternal(this.userPartnerLeftUserId);
        }
        if (this.userMatchFoundUserId) {
          this.subscribeUserMatchFoundInternal(this.userMatchFoundUserId);
        }
        if (this.userPartnerSearchingUserId) {
          this.subscribeUserPartnerSearchingInternal(this.userPartnerSearchingUserId);
        }
        if (this.userCallsUserId) {
          this.subscribeUserCallsInternal(this.userCallsUserId);
        } else {
          const userId = this.auth.user()?.id;
          if (userId) {
            this.userCallsUserId = userId;
            this.subscribeUserCallsInternal(userId);
          }
        }
      },
      onDisconnect: () => this.connected.next(false),
      onWebSocketClose: () => this.connected.next(false),
      onStompError: () => {
        console.warn('STOMP error');
        this.connected.next(false);
      }
    });
    this.client.activate();
  }

  /** Reconnect after token refresh so subscriptions keep working. */
  reconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connected.next(false);
    }
    this.friendRequestsSubscribed = false;
    this.friendMessagesSubscribed = false;
    this.callsSubscribed = false;
    this.friendAcceptedSubscribed = false;
    this.partnerLeftSubscribed = false;
    this.matchFoundSubscribed = false;
    this.partnerSearchingSubscribed = false;
    this.userFriendRequestTopics.clear();
    this.userPartnerLeftTopics.clear();
    this.userMatchFoundTopics.clear();
    this.userPartnerSearchingTopics.clear();
    this.userCallTopics.clear();
    this.resetRoomSubscriptions();
    this.connect();
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connected.next(false);
    }
  }

  /** Wait for STOMP handshake to complete, then run fn. */
  private whenConnected<T>(fn: () => T, timeoutMs = 10000): Observable<T> {
    return new Observable<T>((subscriber) => {
      const doRun = () => {
        try {
          if (!this.client?.connected) {
            throw new Error('No STOMP connection');
          }
          const result = fn();
          subscriber.next(result);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      };
      if (this.client?.connected) {
        doRun();
        return;
      }
      if (!this.client) {
        this.connect();
      }
      const sub = this.connected$.pipe(
        filter((v) => v === true),
        take(1),
        timeout(timeoutMs)
      ).subscribe({
        next: () => doRun(),
        error: (e) => subscriber.error(e)
      });
      return () => sub.unsubscribe();
    });
  }

  sendMessage(
    roomId: string,
    content: string,
    imageUrl?: string,
    messageType: 'TEXT' | 'IMAGE' = 'TEXT',
    meta?: { id: string; timestamp: string }
  ): Observable<void> {
    if (!this.client) this.connect();
    const body: Record<string, string> = {
      messageType,
      id: meta?.id ?? crypto.randomUUID(),
      timestamp: meta?.timestamp ?? new Date().toISOString()
    };
    if (content) body['content'] = content;
    if (imageUrl) body['imageUrl'] = imageUrl;
    return this.whenConnected(() => {
      this.client!.publish({
        destination: `/app/chat/${roomId}/send`,
        body: JSON.stringify(body)
      });
    }).pipe(map(() => undefined));
  }

  subscribeFriendRequests(): Observable<IncomingFriendRequest> {
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribeFriendRequestsInternal()).subscribe();
    return this.friendRequest$;
  }

  subscribeUserFriendRequests(userId?: string | null): Observable<IncomingFriendRequest> {
    if (userId) {
      this.userFriendRequestUserId = userId;
    }
    if (!this.userFriendRequestUserId) return this.friendRequest$;
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribeUserFriendRequestsInternal(this.userFriendRequestUserId!)).subscribe();
    return this.friendRequest$;
  }

  subscribeFriendMessages(): Observable<IncomingFriendMessage> {
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribeFriendMessagesInternal()).subscribe();
    return this.friendMessage$;
  }

  subscribeFriendAccepted(): Observable<{ friendId: string; friendUsername: string }> {
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribeFriendAcceptedInternal()).subscribe();
    return this.friendAccepted$;
  }

  subscribePartnerLeft(): Observable<PartnerLeftEvent> {
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribePartnerLeftInternal()).subscribe();
    return this.partnerLeft$;
  }

  subscribeUserPartnerLeft(userId?: string | null): Observable<PartnerLeftEvent> {
    if (userId) {
      this.userPartnerLeftUserId = userId;
    }
    if (!this.userPartnerLeftUserId) return this.partnerLeft$;
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribeUserPartnerLeftInternal(this.userPartnerLeftUserId!)).subscribe();
    return this.partnerLeft$;
  }

  subscribeMatchFound(): Observable<ChatRoomResponse> {
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribeMatchFoundInternal()).subscribe();
    return this.matchFound$;
  }

  subscribeUserMatchFound(userId?: string | null): Observable<ChatRoomResponse> {
    if (userId) {
      this.userMatchFoundUserId = userId;
    }
    if (!this.userMatchFoundUserId) return this.matchFound$;
    if (!this.client) this.connect();
    this.whenConnected(() => {
      this.subscribeMatchFoundInternal();
      this.subscribeUserMatchFoundInternal(this.userMatchFoundUserId!);
    }).subscribe();
    return this.matchFound$;
  }

  subscribePartnerSearching(): Observable<void> {
    if (!this.client) this.connect();
    this.whenConnected(() => this.subscribePartnerSearchingInternal()).subscribe();
    return this.partnerSearching$;
  }

  subscribeUserPartnerSearching(userId?: string | null): Observable<void> {
    if (userId) {
      this.userPartnerSearchingUserId = userId;
    }
    if (!this.userPartnerSearchingUserId) return this.partnerSearching$;
    if (!this.client) this.connect();
    this.whenConnected(() => {
      this.subscribePartnerSearchingInternal();
      this.subscribeUserPartnerSearchingInternal(this.userPartnerSearchingUserId!);
    }).subscribe();
    return this.partnerSearching$;
  }

  subscribeCalls(userId?: string | null): Observable<CallSignal> {
    if (userId) {
      this.userCallsUserId = userId;
    }
    if (!this.client) this.connect();
    this.whenConnected(() => {
      this.subscribeCallsInternal();
      if (this.userCallsUserId) {
        this.subscribeUserCallsInternal(this.userCallsUserId);
      }
    }).subscribe();
    return this.callSignal$;
  }

  /** Re-subscribe call topic when user id becomes available or after reconnect. */
  ensureUserCallSubscription(userId: string): void {
    this.userCallsUserId = userId;
    if (this.client?.connected) {
      this.subscribeUserCallsInternal(userId);
    }
  }

  sendCallSignal(
    payload: Partial<CallSignal> & { type: CallSignal['type']; toUserId: string; callId: string },
    guard?: () => boolean
  ): Promise<boolean> {
    const body = { ...payload, sentAt: payload.sentAt ?? Date.now() };
    const publish = (): boolean => {
      if (guard && !guard()) return false;
      if (!this.client?.connected) return false;
      this.client.publish({
        destination: '/app/call/signal',
        body: JSON.stringify(body)
      });
      return true;
    };
    if (this.client?.connected) {
      return Promise.resolve(publish());
    }
    if (!this.client) {
      this.connect();
    }
    return this.ensureConnected(8000)
      .then(() => publish())
      .catch(() => publish());
  }

  /** Wait until STOMP is connected (used before placing a call). */
  ensureConnected(timeoutMs = 10000): Promise<void> {
    if (this.client?.connected) {
      return Promise.resolve();
    }
    if (!this.client) {
      this.connect();
    }
    return new Promise((resolve, reject) => {
      const sub = this.connected$.pipe(
        filter((v) => v === true),
        take(1),
        timeout(timeoutMs)
      ).subscribe({
        next: () => resolve(),
        error: (e) => reject(e)
      });
      setTimeout(() => sub.unsubscribe(), timeoutMs + 100);
    });
  }

  private subscribeFriendRequestsInternal(): void {
    if (!this.client?.connected || this.friendRequestsSubscribed) return;
    this.client.subscribe('/user/queue/friend-requests', (msg: IMessage) => {
      try {
        this.friendRequests.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse friend request failed', e);
      }
    });
    this.friendRequestsSubscribed = true;
  }

  private subscribeUserFriendRequestsInternal(userId: string): void {
    if (!this.client?.connected || this.userFriendRequestTopics.has(userId)) return;
    this.client.subscribe(`/topic/user/${userId}/friend-requests`, (msg: IMessage) => {
      try {
        this.friendRequests.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse friend request topic failed', e);
      }
    });
    this.userFriendRequestTopics.add(userId);
  }

  private subscribeFriendMessagesInternal(): void {
    if (!this.client?.connected || this.friendMessagesSubscribed) return;
    this.client.subscribe('/user/queue/friend-messages', (msg: IMessage) => {
      try {
        this.friendMessages.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse friend message notification failed', e);
      }
    });
    this.friendMessagesSubscribed = true;
  }

  private subscribeFriendAcceptedInternal(): void {
    if (!this.client?.connected || this.friendAcceptedSubscribed) return;
    this.client.subscribe('/user/queue/friend-accepted', (msg: IMessage) => {
      try {
        this.friendAccepted.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse friend accepted failed', e);
      }
    });
    this.friendAcceptedSubscribed = true;
  }

  private subscribePartnerLeftInternal(): void {
    if (!this.client?.connected || this.partnerLeftSubscribed) return;
    this.client.subscribe('/user/queue/partner-left', (msg: IMessage) => {
      try {
        this.partnerLeft.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse partner left failed', e);
      }
    });
    this.partnerLeftSubscribed = true;
  }

  private subscribeUserPartnerLeftInternal(userId: string): void {
    if (!this.client?.connected || this.userPartnerLeftTopics.has(userId)) return;
    this.client.subscribe(`/topic/user/${userId}/partner-left`, (msg: IMessage) => {
      try {
        this.partnerLeft.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse partner left topic failed', e);
      }
    });
    this.userPartnerLeftTopics.add(userId);
  }

  private subscribeMatchFoundInternal(): void {
    if (!this.client?.connected || this.matchFoundSubscribed) return;
    this.client.subscribe('/user/queue/match-found', (msg: IMessage) => {
      try {
        this.matchFound.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse match found failed', e);
      }
    });
    this.matchFoundSubscribed = true;
  }

  private subscribeUserMatchFoundInternal(userId: string): void {
    if (!this.client?.connected || this.userMatchFoundTopics.has(userId)) return;
    this.client.subscribe(`/topic/user/${userId}/match-found`, (msg: IMessage) => {
      try {
        this.matchFound.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse match found topic failed', e);
      }
    });
    this.userMatchFoundTopics.add(userId);
  }

  private subscribePartnerSearchingInternal(): void {
    if (!this.client?.connected || this.partnerSearchingSubscribed) return;
    this.client.subscribe('/user/queue/partner-searching', (msg: IMessage) => {
      try {
        this.partnerSearching.next();
      } catch (e) {
        console.warn('Parse partner searching failed', e);
      }
    });
    this.partnerSearchingSubscribed = true;
  }

  private subscribeUserPartnerSearchingInternal(userId: string): void {
    if (!this.client?.connected || this.userPartnerSearchingTopics.has(userId)) return;
    this.client.subscribe(`/topic/user/${userId}/partner-searching`, () => {
      this.partnerSearching.next();
    });
    this.userPartnerSearchingTopics.add(userId);
  }

  private subscribeCallsInternal(): void {
    if (!this.client?.connected || this.callsSubscribed) return;
    this.client.subscribe('/user/queue/calls', (msg: IMessage) => {
      this.emitCallSignal(msg.body);
    });
    this.callsSubscribed = true;
  }

  private subscribeUserCallsInternal(userId: string): void {
    if (!this.client?.connected || this.userCallTopics.has(userId)) return;
    this.client.subscribe(`/topic/user/${userId}/calls`, (msg: IMessage) => {
      this.emitCallSignal(msg.body);
    });
    this.userCallTopics.add(userId);
  }

  private emitCallSignal(body: string): void {
    try {
      const raw = JSON.parse(body) as Record<string, unknown>;
      this.callSignals.next(this.normalizeIncomingSignal(raw));
    } catch (e) {
      console.warn('Parse call signal failed', e);
    }
  }

  private normalizeIncomingSignal(raw: Record<string, unknown>): CallSignal {
    let sdp = raw['sdp'];
    if (typeof sdp === 'string') {
      try {
        sdp = JSON.parse(sdp);
      } catch {
        sdp = undefined;
      }
    }
    if (sdp && typeof sdp === 'object') {
      const s = sdp as Record<string, unknown>;
      const body = typeof s['sdp'] === 'string' ? fixSdpString(s['sdp']) : s['sdp'];
      sdp = { type: s['type'], sdp: body };
    }

    let candidate = raw['candidate'];
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        candidate = undefined;
      }
    }

    return {
      type: raw['type'] as CallSignal['type'],
      fromUserId: String(raw['fromUserId'] ?? ''),
      fromUsername: raw['fromUsername'] as string | undefined,
      toUserId: String(raw['toUserId'] ?? ''),
      callId: String(raw['callId'] ?? ''),
      sentAt: typeof raw['sentAt'] === 'number' ? raw['sentAt'] : Number(raw['sentAt']),
      livekit: raw['livekit'] === true,
      sdp: sdp as RTCSessionDescriptionInit | undefined,
      candidate: candidate as RTCIceCandidateInit | undefined
    };
  }

  sendTyping(roomId: string, typing: boolean): Observable<void> {
    if (!this.client) this.connect();
    return this.whenConnected(() => {
      this.client!.publish({
        destination: `/app/chat/${roomId}/typing`,
        body: JSON.stringify({ typing })
      });
    }).pipe(map(() => undefined));
  }

  subscribeToRoom(roomId: string): Observable<ChatMessage> {
    const key = String(roomId);
    if (!this.client) this.connect();

    let channel = this.roomChannels.get(key);
    if (!channel) {
      channel = { subject: new Subject<ChatMessage>(), stompSub: null };
      this.roomChannels.set(key, channel);
    }

    this.whenConnected(() => this.ensureRoomSubscription(key)).subscribe({
      error: (e) => console.warn('WebSocket not connected for subscribeToRoom', e)
    });

    return channel.subject.asObservable();
  }

  subscribeToTyping(roomId: string): Observable<{ userId: string; typing: boolean }> {
    const key = String(roomId);
    if (!this.client) this.connect();

    let channel = this.typingChannels.get(key);
    if (!channel) {
      channel = { subject: new Subject<{ userId: string; typing: boolean }>(), stompSub: null };
      this.typingChannels.set(key, channel);
    }

    this.whenConnected(() => this.ensureTypingSubscription(key)).subscribe({
      error: (e) => console.warn('WebSocket not connected for subscribeToTyping', e)
    });

    return channel.subject.asObservable();
  }

  private resetRoomSubscriptions(): void {
    for (const channel of this.roomChannels.values()) {
      channel.stompSub = null;
    }
    for (const channel of this.typingChannels.values()) {
      channel.stompSub = null;
    }
  }

  private resubscribeAllRooms(): void {
    for (const roomId of this.roomChannels.keys()) {
      this.ensureRoomSubscription(roomId);
    }
    for (const roomId of this.typingChannels.keys()) {
      this.ensureTypingSubscription(roomId);
    }
  }

  private ensureRoomSubscription(roomId: string): void {
    const channel = this.roomChannels.get(roomId);
    if (!channel || !this.client?.connected || channel.stompSub) return;

    channel.stompSub = this.client.subscribe(`/topic/room/${roomId}`, (msg: IMessage) => {
      try {
        channel.subject.next(JSON.parse(msg.body));
      } catch (e) {
        console.warn('Parse message failed', e);
      }
    });
  }

  private ensureTypingSubscription(roomId: string): void {
    const channel = this.typingChannels.get(roomId);
    if (!channel || !this.client?.connected || channel.stompSub) return;

    channel.stompSub = this.client.subscribe(`/topic/room/${roomId}/typing`, (msg: IMessage) => {
      try {
        const body = JSON.parse(msg.body);
        channel.subject.next({ userId: body.userId, typing: body.typing !== false });
      } catch (e) {
        console.warn('Parse typing failed', e);
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
