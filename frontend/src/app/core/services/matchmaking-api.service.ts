import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatRoomResponse } from './chat-api.service';

@Injectable({ providedIn: 'root' })
export class MatchmakingApiService {
  private base = `${environment.apiUrl}/api/matchmaking`;

  constructor(private http: HttpClient) {}

  startSearch(preference: 'MALE' | 'FEMALE'): Observable<ChatRoomResponse | { status: string; message: string }> {
    return this.http.post<ChatRoomResponse | { status: string; message: string }>(
      `${this.base}/search`,
      null,
      { params: { preference } }
    );
  }

  cancelSearch(): Observable<void> {
    return this.http.post<void>(`${this.base}/cancel`, {});
  }

  getStatus(): Observable<{ inQueue: boolean }> {
    return this.http.get<{ inQueue: boolean }>(`${this.base}/status`);
  }
}
