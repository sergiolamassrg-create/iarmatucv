import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { defer, map, ReplaySubject, take, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { apiUrl, ApiConfigurationError } from '../config/api.config';
import { AuthUser } from '../models/auth-user';

interface ApiResponse<T> { data: T; }
interface Message { message: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  user: AuthUser | null = null;
  private sessionVersion = 0;
  private readonly sessionResolved = new ReplaySubject<void>(1);
  private logoutNotice = '';

  constructor(private readonly http: HttpClient) {
    if (!environment.apiBaseUrl.trim()) { this.resolveSession(); return; }
    const version = this.sessionVersion;
    defer(() => this.http.get<ApiResponse<AuthUser | null>>(apiUrl('auth/sesion'), { withCredentials: true }))
      .pipe(timeout(25000)).subscribe({
        next: response => {
          if (version === this.sessionVersion) this.user = response.data;
          this.resolveSession();
        },
        error: () => { this.resolveSession(); }
      });
  }

  waitForSession() { return this.sessionResolved.pipe(take(1), map(() => this.user)); }

  invalidateSession(): void {
    this.sessionVersion++;
    this.user = null;
    this.resolveSession();
  }

  login(email: string, password: string) {
    return this.post<AuthUser>('ingreso', { email, password }).pipe(tap(response => {
      this.sessionVersion++;
      this.user = response.data;
      this.logoutNotice = '';
      this.resolveSession();
    }));
  }

  register(email: string, password: string, profile: { name: string; familyName: string; nickname: string }) {
    return this.post<{ confirmed: boolean }>('registro', { email, password, ...profile });
  }

  confirm(email: string, code: string) { return this.post<Message>('confirmacion', { email, code }); }
  resend(email: string) { return this.post<Message>('reenviar-codigo', { email }); }
  recover(email: string) { return this.post<Message>('recuperacion', { email }); }
  reset(email: string, code: string, password: string) { return this.post<Message>('restablecer', { email, code, password }); }
  logout() {
    return this.post<Message>('salida', {}).pipe(tap(response => {
      this.sessionVersion++;
      this.user = null;
      this.logoutNotice = response.data.message;
      this.resolveSession();
    }));
  }

  takeLogoutNotice(): string {
    const notice = this.logoutNotice;
    this.logoutNotice = '';
    return notice;
  }

  errorCode(error: unknown): string {
    if (error instanceof ApiConfigurationError) return 'API_NO_CONFIGURADA';
    return error instanceof HttpErrorResponse ? error.error?.error?.codigo ?? '' : '';
  }

  errorMessage(error: unknown): string {
    if (error instanceof ApiConfigurationError) return error.message;
    const message: unknown = error instanceof HttpErrorResponse ? error.error?.error?.mensaje : null;
    return typeof message === 'string' ? message : 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
  }

  private post<T>(path: string, body: object) {
    return defer(() => this.http.post<ApiResponse<T>>(apiUrl(`auth/${path}`), body, { withCredentials: true }))
      .pipe(timeout(25000));
  }

  private resolveSession(): void {
    this.sessionResolved.next();
    this.sessionResolved.complete();
  }
}
