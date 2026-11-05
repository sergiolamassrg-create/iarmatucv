import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth-user';

interface ApiResponse<T> { data: T; }
interface Message { message: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  user: AuthUser | null = null;
  private sessionVersion = 0;
  private readonly url = `${environment.apiBaseUrl}/auth`;

  constructor(private readonly http: HttpClient) {
    const version = this.sessionVersion;
    this.http.get<ApiResponse<AuthUser | null>>(`${this.url}/sesion`, { withCredentials: true })
      .pipe(timeout(25000)).subscribe({ next: response => { if (version === this.sessionVersion) this.user = response.data; }, error: () => {} });
  }

  login(email: string, password: string) {
    return this.post<AuthUser>('ingreso', { email, password }).pipe(tap(response => { this.sessionVersion++; this.user = response.data; }));
  }

  register(email: string, password: string) {
    return this.post<{ confirmed: boolean }>('registro', { email, password });
  }

  confirm(email: string, code: string) { return this.post<Message>('confirmacion', { email, code }); }
  resend(email: string) { return this.post<Message>('reenviar-codigo', { email }); }
  recover(email: string) { return this.post<Message>('recuperacion', { email }); }
  reset(email: string, code: string, password: string) { return this.post<Message>('restablecer', { email, code, password }); }
  logout() { return this.post<Message>('salida', {}).pipe(tap(() => { this.sessionVersion++; this.user = null; })); }

  errorCode(error: unknown): string {
    return error instanceof HttpErrorResponse ? error.error?.error?.codigo ?? '' : '';
  }

  errorMessage(error: unknown): string {
    const message: unknown = error instanceof HttpErrorResponse ? error.error?.error?.mensaje : null;
    return typeof message === 'string' ? message : 'No pudimos conectar con el servicio. Revisá tu conexión e intentá nuevamente.';
  }

  private post<T>(path: string, body: object) {
    return this.http.post<ApiResponse<T>>(`${this.url}/${path}`, body, { withCredentials: true }).pipe(timeout(25000));
  }
}
