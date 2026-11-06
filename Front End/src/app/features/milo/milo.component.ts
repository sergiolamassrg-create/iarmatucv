import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MiloService, MiloTurn } from '../../core/services/milo.service';

@Component({
  selector: 'app-milo', imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './milo.component.html', styleUrl: './milo.component.css'
})
export class MiloComponent {
  private readonly service = inject(MiloService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  turns: MiloTurn[] = [];
  message = '';
  busy = false;
  error = '';
  expired = false;
  get canSend(): boolean { return !this.busy && !this.expired && !!this.message.trim() && this.message.length <= 1000; }

  send(): void {
    if (!this.canSend) return;
    const message = this.message.trim();
    const history = this.turns.slice(-6).map(turn => ({ ...turn, text: turn.text.slice(0, 1000) }));
    this.busy = true;
    this.error = '';
    this.service.send(message, history).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false)).subscribe({
      next: result => {
        this.turns = [...this.turns, { role: 'user', text: message }, { role: 'model', text: result.data.respuesta }].slice(-40) as MiloTurn[];
        this.message = '';
      },
      error: error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.auth.invalidateSession();
          this.expired = true;
          this.turns = [];
          this.message = '';
          this.error = 'Tu sesión venció. Volvé a ingresar para continuar.';
        } else this.error = this.auth.errorMessage(error);
      }
    });
  }
  clear(): void { if (!this.busy) { this.turns = []; this.message = ''; this.error = ''; } }
}
