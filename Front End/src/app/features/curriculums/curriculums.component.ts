import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurriculumsService } from '../../core/services/curriculums.service';
import { AuthService } from '../../core/services/auth.service';
import type { CurriculumSummary } from '../../core/models/curriculum';

@Component({
  selector: 'app-curriculums', standalone: true, imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './curriculums.component.html', styleUrl: './curriculums.component.css'
})
export class CurriculumsComponent {
  private readonly service = inject(CurriculumsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly items = signal<CurriculumSummary[]>([]);
  readonly loading = signal(false);
  readonly duplicating = signal('');
  readonly error = signal('');
  private readonly copyRequests = new Map<string, string>();
  constructor() { this.load(); }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.items.set(response.data); this.loading.set(false); },
      error: error => { this.error.set(this.auth.errorMessage(error)); this.loading.set(false); }
    });
  }
  duplicate(id: string): void {
    if (this.duplicating()) return;
    const requestId = this.copyRequests.get(id) ?? crypto.randomUUID();
    this.copyRequests.set(id, requestId);
    this.duplicating.set(id); this.error.set('');
    this.service.duplicate(id, requestId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.copyRequests.delete(id); this.duplicating.set('');
        void this.router.navigate(['/panel/curriculums', response.data.id]);
      },
      error: error => { this.duplicating.set(''); this.error.set(this.auth.errorMessage(error)); }
    });
  }
}

