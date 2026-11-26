import type { CvDraft } from '../../features/milo-widget/milo-agent.service';
import { profileDraft, type ProfileInput, type JsonObject } from './professional-profile';
export type { CvDraft };
export interface Curriculum { id: string; revision: number; datos: CvDraft; updatedAt: string; }
export interface CurriculumSummary { id: string; titulo: string; plantilla?: 'ats' | 'moderna'; revision: number; updatedAt: string; }

const field = (item: JsonObject, key: string) => typeof item[key] === 'string' ? item[key] as string : '';
export function emptyCurriculum(): CvDraft {
  return { titulo: '', tituloProfesional: '', plantilla: 'ats', resumen: '', experiencias: [], educacion: [], habilidades: [] };
}
export function curriculumFromProfile(profile?: ProfileInput | null): CvDraft {
  if (!profile) return emptyCurriculum();
  const dates = (item: JsonObject) => ({
    fechaInicio: field(item, 'fechaInicio').slice(0, 40), fechaFin: field(item, 'fechaFin').slice(0, 40)
  });
  return {
    titulo: field(profile.perfilProfesional, 'titulo').slice(0, 120),
    tituloProfesional: field(profile.perfilProfesional, 'titulo').slice(0, 120),
    plantilla: 'ats',
    resumen: field(profile.perfilProfesional, 'resumen').slice(0, 1500),
    experiencias: profile.experiencias.slice(0, 12).map(item => ({
      empresa: field(item, 'empresa').slice(0, 120), puesto: field(item, 'puesto').slice(0, 120),
      descripcion: (field(item, 'descripcion') || ['responsabilidades', 'logros'].flatMap(key =>
        Array.isArray(item[key]) ? (item[key] as unknown[]).filter(value => typeof value === 'string') : []).join('\n')).slice(0, 800),
      ...dates(item), actual: item['actual'] === true
    })),
    educacion: profile.educacion.slice(0, 12).map(item => ({
      institucion: field(item, 'institucion').slice(0, 120), titulo: field(item, 'titulo').slice(0, 160), ...dates(item)
    })),
    habilidades: profile.habilidades.map(item => field(item, 'nombre').slice(0, 100)).filter(Boolean).slice(0, 12)
  };
}
// Personal data is shared at render time; professional data comes only from this CV.
export function profileForCurriculum(shared: ProfileInput, cv: CvDraft): ProfileInput {
  const result = profileDraft();
  result.datosPersonales = structuredClone(shared.datosPersonales);
  result.preferenciasPrivacidad = structuredClone(shared.preferenciasPrivacidad);
  // Legacy CVs have only an internal title: never reuse it as a visible heading.
  result.perfilProfesional = { titulo: cv.tituloProfesional ?? '', resumen: cv.resumen };
  result.experiencias = cv.experiencias.map(item => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) as JsonObject);
  result.educacion = cv.educacion.map(item => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) as JsonObject);
  result.habilidades = cv.habilidades.map(nombre => ({ nombre }));
  return result;
}

