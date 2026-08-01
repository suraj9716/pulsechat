import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PublicUserProfile {
  id: string;
  username: string;
  gender: 'MALE' | 'FEMALE';
  bio?: string;
  onlineStatus: boolean;
}

export interface MyProfile extends PublicUserProfile {
  email: string;
  role: string;
  createdAt: string;
}

export interface UpdateProfileRequest {
  username?: string;
  bio?: string;
  gender?: 'MALE' | 'FEMALE';
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private base = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<MyProfile> {
    return this.http.get<MyProfile>(`${this.base}/me`);
  }

  updateMyProfile(body: UpdateProfileRequest): Observable<MyProfile> {
    return this.http.put<MyProfile>(`${this.base}/me`, body);
  }

  getUserProfile(userId: string): Observable<PublicUserProfile> {
    return this.http.get<PublicUserProfile>(`${this.base}/${userId}`);
  }

  searchUsers(username: string): Observable<PublicUserProfile[]> {
    return this.http.get<PublicUserProfile[]>(`${this.base}/search`, { params: { username } });
  }
}
