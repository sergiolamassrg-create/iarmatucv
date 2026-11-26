import type { Content, FunctionCall } from '@google/genai';
import type { ProfileInput } from '../models/professional-profile.js';

export type ProfileField = 'datosPersonales.nombre' | 'datosPersonales.apellido' | 'datosPersonales.nombreProfesional' | 'perfilProfesional.titulo' | 'perfilProfesional.resumen';
export interface ProfileProposal {
  id: string; cambios: { campo: ProfileField; anterior: string; valor: string }[];
  expectedUpdatedAt: string; expiresAt: number;
}

export interface CvDraft {
  titulo: string;
  tituloProfesional?: string;
  plantilla?: 'ats' | 'moderna';
  resumen: string;
  experiencias: { empresa: string; puesto: string; descripcion: string; fechaInicio?: string; fechaFin?: string; actual?: boolean }[];
  educacion: { institucion: string; titulo: string; fechaInicio?: string; fechaFin?: string }[];
  habilidades: string[];
}
export interface Curriculum { id: string; revision: number; datos: CvDraft; updatedAt: string; lastRequestId?: string; duplicatedFrom?: string; }
export interface Proposal {
  id: string; tipo: 'crear' | 'editar'; curriculumId: string;
  revision: number; datos: CvDraft; anterior: CvDraft | null; expiresAt: number;
}
export interface Message { role: 'user' | 'model'; text: string; at: number; }
export interface AgentState {
  userId: string; conversationId: string; messages: Message[]; cvs: Curriculum[];
  pending: Proposal | null; completed: string[]; requests: string[];
  profilePending?: ProfileProposal | null;
  historyExpiresAt: number;
}
export interface AgentConfig {
  enabled: boolean; table: string; model: string; apiKey: string;
  timeoutMs: number; maxMessageChars: number; maxHistory: number; maxOutputTokens: number;
  maxTools: number; maxCvs: number; userMinute: number; userDay: number;
  globalMinute: number; globalDay: number; retentionDays: number;
}
export interface AgentStore {
  read(subject: string): Promise<AgentState | null>;
  acquire(subject: string, owner: string, config: AgentConfig, consume: boolean): Promise<void>;
  save(subject: string, owner: string, state: AgentState): Promise<void>;
  saveProfile(subject: string, owner: string, state: AgentState, profile: ProfileInput, expectedUpdatedAt: string): Promise<void>;
  release(subject: string, owner: string): Promise<void>;
}
export interface AgentModel {
  step(contents: Content[], signal: AbortSignal): Promise<{ content: Content; text: string; calls: FunctionCall[] }>;
}
export interface AgentPorts {
  store: AgentStore;
  model: AgentModel;
  profile(subject: string): Promise<unknown>;
  config(): AgentConfig;
}

