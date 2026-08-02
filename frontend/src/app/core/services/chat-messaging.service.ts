import { Injectable } from '@angular/core';
import { MessageResponse } from './chat-api.service';
import { LocalMessageStoreService } from './local-message-store.service';
import { WebSocketService } from './websocket.service';
import { ChatApiService } from './chat-api.service';
import { Observable, catchError, from, map, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatMessagingService {
  constructor(
    private localStore: LocalMessageStoreService,
    private ws: WebSocketService,
    private chatApi: ChatApiService
  ) {}

  async loadRoomMessages(roomId: string, friendId?: string): Promise<MessageResponse[]> {
    return this.localStore.getRoomMessages(roomId, friendId);
  }

  async persistIncoming(
    msg: MessageResponse,
    friendId: string | null,
    myUserId: string,
    activeChatFriendId: string | null,
    roomId?: string
  ): Promise<void> {
    const chatRoomId = String(msg.chatRoomId || roomId || '');
    const normalized = this.normalizeServerMessage({ ...msg, chatRoomId }, chatRoomId);
    const incrementUnread = !!friendId && msg.senderId !== myUserId && activeChatFriendId !== msg.senderId;
    await this.localStore.saveMessage(normalized, {
      friendId: friendId ?? msg.senderId,
      myUserId,
      incrementUnread,
      roomId: chatRoomId
    });
  }

  sendText(
    room: { id: string; participant: { id: string } },
    myUserId: string,
    text: string,
    friendId?: string
  ): Observable<MessageResponse> {
    const outbound = this.localStore.createOutboundMessage(room.id, myUserId, room.participant.id, text);
    const fid = friendId ?? room.participant.id;
    return from(this.localStore.saveMessage(outbound, { friendId: fid, myUserId, roomId: room.id })).pipe(
      switchMap(() =>
        this.ws
          .sendMessage(room.id, text, undefined, 'TEXT', { id: outbound.id, timestamp: outbound.timestamp })
          .pipe(
            catchError(() =>
              this.chatApi
                .sendMessage(room.id, text, { clientMessageId: outbound.id, timestamp: outbound.timestamp })
                .pipe(map(() => outbound))
            ),
            map(() => outbound)
          )
      )
    );
  }

  sendImage(
    room: { id: string; participant: { id: string } },
    myUserId: string,
    imageUrl: string,
    friendId?: string
  ): Observable<MessageResponse> {
    const outbound = this.localStore.createOutboundMessage(room.id, myUserId, room.participant.id, '', {
      messageType: 'IMAGE',
      imageUrl
    });
    const fid = friendId ?? room.participant.id;
    return from(this.localStore.saveMessage(outbound, { friendId: fid, myUserId, roomId: room.id })).pipe(
      switchMap(() =>
        this.ws
          .sendMessage(room.id, '', imageUrl, 'IMAGE', { id: outbound.id, timestamp: outbound.timestamp })
          .pipe(
            catchError(() =>
              this.chatApi.sendMessage(room.id, '', {
                messageType: 'IMAGE',
                imageUrl,
                clientMessageId: outbound.id,
                timestamp: outbound.timestamp
              }).pipe(map(() => outbound))
            ),
            map(() => outbound)
          )
      )
    );
  }

  markRoomRead(roomId: string, friendId: string): Promise<void> {
    return this.localStore.markRoomRead(roomId, friendId);
  }

  private normalizeServerMessage(msg: MessageResponse, roomId: string): MessageResponse {
    return {
      ...msg,
      id: String(msg.id),
      senderId: String(msg.senderId),
      receiverId: String(msg.receiverId),
      chatRoomId: String(msg.chatRoomId || roomId),
      timestamp:
        typeof msg.timestamp === 'string'
          ? msg.timestamp
          : msg.timestamp
            ? new Date(String(msg.timestamp)).toISOString()
            : new Date().toISOString()
    };
  }
}
