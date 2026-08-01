import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BlockApiService {
  private base = `${environment.apiUrl}/api/blocks`;

  constructor(private http: HttpClient) {}

  blockUser(userId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${userId}`, {});
  }

  unblockUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${userId}`);
  }
}
