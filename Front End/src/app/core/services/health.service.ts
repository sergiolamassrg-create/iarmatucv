import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiHealthResponse } from '../models/api-health';

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private readonly http: HttpClient) {}

  getHealth(): Observable<ApiHealthResponse> {
    return this.http.get<ApiHealthResponse>(`${environment.apiBaseUrl}/health`)
      .pipe(timeout(5000));
  }
}
