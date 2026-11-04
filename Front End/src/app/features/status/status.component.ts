import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { HealthService } from '../../core/services/health.service';
import { ApiHealthResponse } from '../../core/models/api-health';

@Component({
  selector: 'app-status',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './status.component.html'
})
export class StatusComponent implements OnInit, OnDestroy {
  state: 'loading' | 'success' | 'error' = 'loading';
  health: ApiHealthResponse['data'] | null = null;
  private request?: Subscription;

  constructor(private readonly healthService: HealthService) {}

  ngOnInit(): void { this.check(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  check(): void {
    this.request?.unsubscribe();
    this.state = 'loading';
    this.health = null;
    this.request = this.healthService.getHealth().subscribe({
      next: (response) => {
        if (response?.data?.estado !== 'ok') {
          this.state = 'error';
          return;
        }
        this.health = response.data;
        this.state = 'success';
      },
      error: () => { this.state = 'error'; }
    });
  }
}
