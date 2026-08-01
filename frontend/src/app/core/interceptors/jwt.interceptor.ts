import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { WebSocketService } from '../services/websocket.service';
import { Router } from '@angular/router';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const ws = inject(WebSocketService);
  const router = inject(Router);

  const withAuth = (token: string | null) =>
    token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  const isAuthRoute = req.url.includes('/api/auth/');
  const token = isAuthRoute ? null : auth.getAccessToken();

  return next(withAuth(token)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (isAuthRoute || (err.status !== 401 && err.status !== 403)) {
        return throwError(() => err);
      }
      return auth.refreshToken().pipe(
        tap(() => ws.reconnect()),
        switchMap((res) => next(withAuth(res.accessToken))),
        catchError(() => {
          auth.logout();
          router.navigate(['/auth/login']);
          return throwError(() => err);
        })
      );
    })
  );
};
