import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, Observable, timeout } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { ApiHealthResponse } from '../models/api-health';

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private readonly http: HttpClient) {}

  getHealth(): Observable<ApiHealthResponse> {
    return defer(() => this.http.get<ApiHealthResponse>(apiUrl('health')))
      .pipe(timeout(5000));
  }
}
