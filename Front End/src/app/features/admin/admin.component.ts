import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timeout } from 'rxjs';
import { apiUrl } from '../../core/config/api.config';
import { AuthService } from '../../core/services/auth.service';

interface Account {
  id: string; email: string; nombre: string; habilitado: boolean; estado: string;
  registrado: string | null; administrador: boolean;
}
@Component({
  selector: 'app-admin', standalone: true, imports: [DatePipe], changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.component.html', styleUrl: './admin.component.css'
})
export class AdminComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly accounts = signal<Account[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly next = signal<string | null>(null);
  readonly pending = signal<Account | null>(null);
  constructor() { this.load(); }
  get enabledCount(): number { return this.accounts().filter(account => account.habilitado).length; }
  load(page?: string | null): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true); this.error.set(''); this.pending.set(null);
    this.http.get<{ data: { usuarios: Account[]; siguiente: string | null } }>(apiUrl('admin/usuarios'), {
      params: page ? { pagina: page } : {}
    }).pipe(timeout(25000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.accounts.set(response.data.usuarios); this.next.set(response.data.siguiente); this.loading.set(false); },
      error: error => { this.error.set(this.auth.errorMessage(error)); this.loading.set(false); }
    });
  }
  confirm(): void {
    const account = this.pending();
    if (!account || account.administrador || this.saving()) return;
    this.saving.set(true); this.error.set(''); this.message.set('');
    this.http.put<{ data: Account }>(apiUrl('admin/usuarios/' + encodeURIComponent(account.id) + '/estado'), {
      habilitado: !account.habilitado
    }).pipe(timeout(25000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.accounts.update(accounts => accounts.map(item => item.id === response.data.id ? response.data : item));
        this.saving.set(false); this.pending.set(null);
        this.message.set(response.data.habilitado ? 'Cuenta habilitada. Ya puede iniciar sesión.' : 'Cuenta deshabilitada. Se bloquea su acceso y sus datos se conservan.');
      },
      error: error => { this.error.set(this.auth.errorMessage(error)); this.saving.set(false); }
    });
  }
}
