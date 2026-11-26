import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, finalize, map, Observable, of, shareReplay, tap, throwError, timeout } from 'rxjs';
import { apiUrl, ApiConfigurationError } from '../config/api.config';
import { AuthUser } from '../models/auth-user';

interface ApiResponse<T> { data: T; }
interface Message { message: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  user: AuthUser | null = null;
  private accessToken: string | null = null;
  private expiresAt = 0;
  private sessionReady = false;
  private restoring?: Observable<AuthUser | null>;
  private version = 0;
  sessionError = '';
  private logoutNotice = '';

  constructor(private readonly http: HttpClient) {}

  // Cookie renewal is enabled only behind a same-origin API path, never cross-site.
  get persistentSession(): boolean { return /^\/(?!\/)/.test(apiUrl('')); }

  waitForSession() {
    if (this.sessionReady && (!this.user || this.getAccessToken())) return of(this.user);
    return this.restoreSession().pipe(catchError(() => of(null)));
  }

  restoreSession(force = false): Observable<AuthUser | null> {
    if (!this.persistentSession) { this.sessionReady = true; return of(this.user); }
    try { if (localStorage.getItem('iarmatucv.signedOut') === 'true') { this.sessionReady = true; return of(null); } } catch { /* Storage can be unavailable. */ }
    if (this.restoring) return this.restoring;
    if (this.sessionReady && !force && (!this.user || this.getAccessToken())) return of(this.user);
    const version = this.version;
    const request = defer(() => this.http.post<ApiResponse<AuthUser | null> & { session?: { accessToken: string; expiresAt: number } }>(
      apiUrl('auth/renovar'), {}, { withCredentials: true })).pipe(
      timeout(15000),
      map(response => {
        if (version !== this.version) return this.user;
        if (response?.data) this.accept(response as ApiResponse<AuthUser> & { session?: { accessToken: string; expiresAt: number } });
        else if (response?.data === null) { this.accessToken = null; this.expiresAt = 0; this.user = null; }
        else throw new HttpErrorResponse({ status: 503, error: { error: {
          codigo: 'RENOVACION_NO_DISPONIBLE', mensaje: 'El servicio de recuperación de sesión no está disponible.'
        } } });
        this.sessionError = ''; this.sessionReady = true;
        return this.user;
      }),
      catchError(error => {
        if (version !== this.version) return of(this.user);
        this.sessionReady = true;
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.invalidateSession(); return of(null);
        }
        this.sessionError = 'No pudimos recuperar tu sesión. Revisá tu conexión y reintentá; no hace falta ingresar de nuevo todavía.';
        return throwError(() => error);
      }),
      finalize(() => { if (this.restoring === request) this.restoring = undefined; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.restoring = request;
    return request;
  }

  ensureAccess() {
    const token = this.getAccessToken();
    if (token || !this.persistentSession) return of(token);
    return this.restoreSession(true).pipe(map(() => this.getAccessToken()));
  }

  invalidateSession(): void {
    this.version++;
    this.restoring = undefined;
    this.accessToken = null;
    this.expiresAt = 0;
    this.user = null;
    this.sessionError = '';
    this.logoutNotice = 'Tu sesión venció. Volvé a ingresar para continuar.';
    this.sessionReady = true;
  }

  getAccessToken(): string | null {
    if (this.accessToken && this.expiresAt <= Date.now()) {
      if (this.persistentSession) return null;
      this.invalidateSession();
    }
    return this.accessToken;
  }

  isAuthenticated(): boolean { return Boolean(this.getAccessToken() && this.user); }

  login(email: string, password: string) {
    return defer(() => {
      const version = ++this.version;
      this.restoring = undefined;
      return this.post<AuthUser>('ingreso', { email, password, transport: this.persistentSession ? 'bearer-cookie' : 'bearer' }).pipe(tap(response => {
        if (version === this.version) this.accept(response);
      }));
    });
  }

  private accept(response: ApiResponse<AuthUser> & { session?: { accessToken: string; expiresAt: number } }): void {
    const session = response.session;
    if (!session?.accessToken || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      throw new HttpErrorResponse({ status: 503, error: { error: {
        codigo: 'ACCESO_NO_ACTUALIZADO', mensaje: 'El servicio de acceso requiere actualizarse. Intentá nuevamente más tarde.'
      } } });
    }
    this.accessToken = session.accessToken;
    this.expiresAt = session.expiresAt;
    this.user = response.data;
    this.logoutNotice = '';
    this.sessionReady = true;
    this.sessionError = '';
    try { localStorage.removeItem('iarmatucv.signedOut'); } catch { /* No credentials are stored here. */ }
  }

  register(email: string, password: string, profile: { name: string; familyName: string; nickname: string }) {
    return this.post<{ confirmed: boolean }>('registro', { email, password, ...profile });
  }

  confirm(email: string, code: string) { return this.post<Message>('confirmacion', { email, code }); }
  resend(email: string) { return this.post<Message>('reenviar-codigo', { email }); }
  recover(email: string) { return this.post<Message>('recuperacion', { email }); }
  reset(email: string, code: string, password: string) { return this.post<Message>('restablecer', { email, code, password }); }
  logout() {
    return defer(() => {
      const token = this.getAccessToken();
      this.invalidateSession();
      // A non-secret flag prevents restoring an HttpOnly cookie after an offline logout.
      try { localStorage.setItem('iarmatucv.signedOut', 'true'); } catch { /* Remote revocation remains authoritative. */ }
      return this.http.post<ApiResponse<Message>>(apiUrl('auth/salida'), {}, {
        withCredentials: this.persistentSession, headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).pipe(timeout(25000), catchError(() => of({ data: {
        message: 'Sesión cerrada en este navegador. No pudimos confirmar el cierre remoto; puede seguir válido hasta su vencimiento.'
      } })), tap(response => { this.logoutNotice = response.data.message; }));
    });
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
    return defer(() => this.http.post<ApiResponse<T> & { session?: { accessToken: string; expiresAt: number } }>(
      apiUrl(`auth/${path}`), body, { withCredentials: this.persistentSession }))
      .pipe(timeout(25000));
  }

}
