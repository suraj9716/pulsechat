import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserSummary {
  id: string;
  username: string;
  gender?: 'MALE' | 'FEMALE';
  bio?: string;
  onlineStatus: boolean;
}

export interface FriendRequest {
  id: string;
  sender: UserSummary;
  receiver: UserSummary;
  status: string;
  createdAt: string;
}

export interface FriendListItem {
  friend: UserSummary;
  roomId?: string;
  unreadCount: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

export interface FriendStatusResponse {
  friends: boolean;
  pendingSent: boolean;
  pendingReceived: boolean;
  pendingReceivedRequestId?: string;
}

@Injectable({ providedIn: 'root' })
export class FriendApiService {
  private base = `${environment.apiUrl}/api/friends`;
  private usersBase = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient) {}

  getFriends(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.base);
  }

  getFriendsOverview(): Observable<FriendListItem[]> {
    return this.http.get<FriendListItem[]>(`${this.base}/overview`);
  }

  getPendingRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.base}/requests/pending`);
  }

  getPendingSent(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.base}/requests/sent`);
  }

  sendRequest(receiverId: string): Observable<FriendRequest> {
    return this.http.post<FriendRequest>(`${this.base}/request/${receiverId}`, {});
  }

  accept(requestId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/request/${requestId}/accept`, {});
  }

  reject(requestId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/request/${requestId}/reject`, {});
  }

  removeFriend(friendId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${friendId}`);
  }

  areFriends(userId: string): Observable<{ friends: boolean }> {
    return this.getRelationshipStatus(userId).pipe(map((s) => ({ friends: s.friends })));
  }

  getRelationshipStatus(userId: string): Observable<FriendStatusResponse> {
    return this.http.get<FriendStatusResponse>(`${this.base}/status/${userId}`);
  }

  searchUsers(username: string): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.usersBase}/search`, { params: { username } });
  }
}
