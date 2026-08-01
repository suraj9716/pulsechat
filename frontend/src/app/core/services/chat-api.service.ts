import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatRoomResponse {
  id: string;
  participant: { id: string; username: string; onlineStatus: boolean };
  active: boolean;
  friendChat?: boolean;
}

export interface NextPartnerResponse {
  status: 'matched' | 'searching';
  room?: ChatRoomResponse;
}

export interface MessageResponse {
  id: string;
  senderId: string;
  receiverId: string;
  chatRoomId: string;
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'CALL';
  imageUrl?: string;
  status: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private base = `${environment.apiUrl}/api/chat`;

  constructor(private http: HttpClient) {}

  getCurrentRoom(): Observable<ChatRoomResponse | null> {
    return this.http.get<ChatRoomResponse | null>(`${this.base}/room/current`);
  }

  getMessages(roomId: string, page = 0, size = 50): Observable<MessageResponse[]> {
    return this.http.get<MessageResponse[]>(`${this.base}/room/${roomId}/messages`, {
      params: { page: String(page), size: String(size) }
    });
  }

  sendMessage(roomId: string, content: string, opts?: { messageType?: 'TEXT' | 'IMAGE' | 'CALL'; imageUrl?: string }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/room/${roomId}/messages`, {
      content: content || null,
      messageType: opts?.messageType ?? 'TEXT',
      imageUrl: opts?.imageUrl ?? null
    });
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/upload/image`, form);
  }

  getFriendRoom(friendId: string): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.base}/friends/${friendId}/room`);
  }

  getFriendConversations(): Observable<ChatRoomResponse[]> {
    return this.http.get<ChatRoomResponse[]>(`${this.base}/friends/conversations`);
  }

  getUnreadSummary(): Observable<{ totalUnread: number }> {
    return this.http.get<{ totalUnread: number }>(`${this.base}/friends/unread`);
  }

  markRoomRead(roomId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/room/${roomId}/read`, {});
  }

  logCall(friendId: string, content: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/friends/${friendId}/call-log`, { content });
  }

  nextPartner(roomId: string): Observable<NextPartnerResponse> {
    return this.http.post<NextPartnerResponse>(`${this.base}/room/${roomId}/next`, {});
  }
}
