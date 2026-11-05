import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, Observable, timeout } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { CvTemplate } from '../models/cv-template';

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  constructor(private readonly http: HttpClient) {}

  getTemplates(): Observable<{ data: CvTemplate[] }> {
    return defer(() => this.http.get<{ data: CvTemplate[] }>(apiUrl('plantillas')))
      .pipe(timeout(5000));
  }
}
