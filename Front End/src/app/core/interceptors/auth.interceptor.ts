import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = apiUrl('');
  // Never send credentials to external URLs, assets or similarly named hosts.
  if (!request.url.startsWith(base)) return next(request);
  const auth = inject(AuthService);
  const publicAuth = /\/auth\/(ingreso|renovar|registro|confirmacion|reenviar-codigo|recuperacion|restablecer)(?:[?#]|$)/.test(request.url);
  if (publicAuth) return next(request.clone({ withCredentials: auth.persistentSession }));
  // Logout must never start a renewal after the local session has been cleared.
  if (/\/auth\/salida(?:[?#]|$)/.test(request.url)) return next(request.clone({ withCredentials: auth.persistentSession }));
  return auth.ensureAccess().pipe(switchMap(token => {
    const authenticated = request.clone({
      withCredentials: false,
      ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {})
    });
    return next(authenticated).pipe(catchError(error => {
      // A late failure from a previous session must not erase a newer login.
      if (error instanceof HttpErrorResponse && error.status === 401 && token && token === auth.getAccessToken()) {
        auth.invalidateSession();
      }
      // Navigation is explicit in the UI/guard; no redirects or retries here.
      return throwError(() => error);
    }));
  }));
};
