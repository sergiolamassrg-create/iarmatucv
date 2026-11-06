import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, timeout } from 'rxjs';
import { apiUrl } from '../config/api.config';

export interface MiloTurn { role: 'user' | 'model'; text: string; }

@Injectable({ providedIn: 'root' })
export class MiloService {
  private readonly http = inject(HttpClient);
  send(mensaje: string, historial: MiloTurn[]) {
    return defer(() => this.http.post<{ data: { respuesta: string; estado: 'ok' } }>(
      apiUrl('milo/chat'), { mensaje, historial }, { withCredentials: true }
    )).pipe(timeout(25000));
  }
}
