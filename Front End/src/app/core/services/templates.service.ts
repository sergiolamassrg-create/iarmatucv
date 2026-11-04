import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CvTemplate } from '../models/cv-template';

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  constructor(private readonly http: HttpClient) {}

  getTemplates(): Observable<{ data: CvTemplate[] }> {
    return this.http.get<{ data: CvTemplate[] }>(`${environment.apiBaseUrl}/plantillas`)
      .pipe(timeout(5000));
  }
}
