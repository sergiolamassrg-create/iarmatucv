import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, tap, timeout } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { AuthService } from './auth.service';
import { ProfileInput, ProfessionalProfile } from '../models/professional-profile';

type ProfileState = { status: 'loading' | 'ready' | 'missing' | 'error' | 'expired'; profile: ProfessionalProfile | null; message: string };

@Injectable()
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = signal<ProfileState>({ status: 'loading', profile: null, message: '' });
  dirty = false;
  saving = false;

  constructor() { this.load(); }

  load(): void {
    this.state.set({ status: 'loading', profile: null, message: '' });
    defer(() => this.http.get<{ data: ProfessionalProfile }>(apiUrl('perfil'), { withCredentials: true }))
      .pipe(timeout(30000), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => this.accept(response.data),
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 404 && this.auth.errorCode(error) === 'PERFIL_NO_ENCONTRADO') {
            this.state.set({ status: 'missing', profile: null, message: '' });
          } else {
            this.handleError(error);
            if (this.state().status !== 'expired') this.state.set({ status: 'error', profile: null, message: this.auth.errorMessage(error) });
          }
        }
      });
  }

  save(profile: ProfileInput) {
    return defer(() => this.http.put<{ data: ProfessionalProfile }>(apiUrl('perfil'), profile, { withCredentials: true }))
      .pipe(timeout(30000), tap(response => this.accept(response.data)));
  }

  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.auth.invalidateSession();
      this.state.set({ status: 'expired', profile: null, message: 'Tu sesión venció. Volvé a ingresar para continuar.' });
    }
  }

  confirmLeave(): boolean { return !this.dirty || window.confirm('Tenés cambios sin guardar. ¿Querés salir y descartarlos?'); }

  private accept(profile: ProfessionalProfile): void {
    this.dirty = false;
    this.state.set({ status: 'ready', profile, message: '' });
  }
}
