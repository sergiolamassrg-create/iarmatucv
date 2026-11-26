import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, timeout } from 'rxjs';
import { apiUrl } from '../config/api.config';
import type { Curriculum, CurriculumSummary, CvDraft } from '../models/curriculum';

@Injectable()
export class CurriculumsService {
  private readonly http = inject(HttpClient);
  list() { return defer(() => this.http.get<{ data: CurriculumSummary[] }>(apiUrl('curriculums'))).pipe(timeout(30000)); }
  get(id: string) { return defer(() => this.http.get<{ data: Curriculum }>(apiUrl('curriculums/' + encodeURIComponent(id)))).pipe(timeout(30000)); }
  create(datos: CvDraft, requestId: string) {
    return defer(() => this.http.post<{ data: Curriculum }>(apiUrl('curriculums'), { datos, requestId })).pipe(timeout(30000));
  }
  update(cv: Curriculum, datos: CvDraft, requestId: string) {
    return defer(() => this.http.put<{ data: Curriculum }>(apiUrl('curriculums/' + encodeURIComponent(cv.id)), {
      datos, requestId, revision: cv.revision
    })).pipe(timeout(30000));
  }
  duplicate(id: string, requestId: string) {
    return defer(() => this.http.post<{ data: Curriculum }>(apiUrl('curriculums/' + encodeURIComponent(id) + '/duplicar'), { requestId })).pipe(timeout(30000));
  }
}

