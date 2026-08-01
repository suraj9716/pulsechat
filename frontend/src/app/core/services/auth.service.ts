import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  username: string;
  email: string;
  gender: string;
  bio?: string;
  onlineStatus: boolean;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  gender: 'MALE' | 'FEMALE';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_KEY = 'refresh_token';
  private readonly USER_KEY = 'user';

  private currentUser = signal<User | null>(null);
  private token = signal<string | null>(null);

  user = this.currentUser.asReadonly();
  isAuthenticated = computed(() => !!this.token());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();
  }

  private loadStoredAuth(): void {
    const t = localStorage.getItem(this.TOKEN_KEY);
    const u = localStorage.getItem(this.USER_KEY);
    if (t && u) {
      this.token.set(t);
      this.currentUser.set(JSON.parse(u));
    }
  }

  register(req: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/register`, req).pipe(
      tap((res) => this.setSession(res))
    );
  }

  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, req).pipe(
      tap((res) => this.setSession(res))
    );
  }

  refreshToken(): Observable<AuthResponse> {
    const refresh = localStorage.getItem(this.REFRESH_KEY);
    if (!refresh) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/refresh`, { refreshToken: refresh }).pipe(
      tap((res) => this.setSession(res))
    );
  }

  logout(): void {
    const refresh = localStorage.getItem(this.REFRESH_KEY);
    if (refresh) {
      this.http.post(`${environment.apiUrl}/api/auth/logout`, { refreshToken: refresh }).subscribe();
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getAccessToken(): string | null {
    return this.token() ?? localStorage.getItem(this.TOKEN_KEY);
  }

  updateStoredUser(partial: Partial<User>): void {
    const current = this.currentUser();
    if (!current) return;
    const updated = { ...current, ...partial };
    localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
    this.currentUser.set(updated);
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.token.set(res.accessToken);
    this.currentUser.set(res.user);
  }
}
