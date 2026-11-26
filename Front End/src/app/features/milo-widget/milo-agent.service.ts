import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, timeout } from 'rxjs';
import { apiUrl } from '../../core/config/api.config';

export interface CvDraft {
  titulo: string; tituloProfesional?: string; resumen: string;
  plantilla?: 'ats' | 'moderna';
  experiencias: { empresa: string; puesto: string; descripcion: string; fechaInicio?: string; fechaFin?: string; actual?: boolean }[];
  educacion: { institucion: string; titulo: string; fechaInicio?: string; fechaFin?: string }[]; habilidades: string[];
}
export interface Proposal {
  id: string; tipo: 'crear' | 'editar'; curriculumId: string; revision: number;
  datos: CvDraft; anterior: CvDraft | null; expiresAt: number;
}
export interface Conversation {
  propuestaPerfil?: { id: string; cambios: { campo: string; anterior: string; valor: string }[]; expiresAt: number } | null;
  conversationId: string;
  messages: { role: 'user' | 'model'; text: string; at: number }[];
  propuesta: Proposal | null;
  curriculums: { id: string; titulo: string; revision: number; updatedAt: string }[];
}
@Injectable()
export class MiloAgentService {
  private readonly http = inject(HttpClient);
  private url(path: string) { return apiUrl('milo/agente/' + path); }
  history() {
    return defer(() => this.http.get<{ data: Conversation }>(this.url('conversacion'), { withCredentials: false })).pipe(timeout(60000));
  }
  private post(path: string, body: object) {
    return defer(() => this.http.post<{ data: Conversation }>(this.url(path), body, { withCredentials: false })).pipe(timeout(60000));
  }
  send(mensaje: string, requestId: string) { return this.post('mensajes', { mensaje, requestId }); }
  newConversation() { return this.post('conversacion', {}); }
  confirm(propuestaId: string) { return this.post('confirmaciones', { propuestaId, confirmar: true }); }
  confirmProfile(propuestaId: string) { return this.post('confirmaciones-perfil', { propuestaId, confirmar: true }); }
  cancel(propuestaId: string) { return this.post('cancelaciones', { propuestaId }); }
  cv(id: string) {
    return defer(() => this.http.get<{ data: { id: string; datos: CvDraft } }>(
      this.url('curriculums/' + encodeURIComponent(id)), { withCredentials: false })).pipe(timeout(60000));
  }
}

