export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue; }
export const listSections = ['experiencias', 'educacion', 'habilidades', 'idiomas', 'certificaciones',
  'proyectos', 'licencias', 'voluntariados', 'reconocimientos'] as const;
export type ListSection = typeof listSections[number];
export type ProfileInput = Record<ListSection, JsonObject[]> & {
  datosPersonales: JsonObject;
  perfilProfesional: JsonObject;
  preferenciasPrivacidad: JsonObject;
  camposPendientesDeValidacion: string[];
};
export type ProfessionalProfile = ProfileInput & { userId: string; schemaVersion: number; createdAt: string; updatedAt: string };

export function profileDraft(profile?: ProfessionalProfile): ProfileInput {
  const draft: ProfileInput = {
    datosPersonales: {}, perfilProfesional: {}, preferenciasPrivacidad: {},
    experiencias: [], educacion: [], habilidades: [], idiomas: [], certificaciones: [],
    proyectos: [], licencias: [], voluntariados: [], reconocimientos: [], camposPendientesDeValidacion: []
  };
  if (profile) {
    for (const key of Object.keys(draft) as (keyof ProfileInput)[]) {
      if (profile[key] !== undefined) Object.assign(draft, { [key]: structuredClone(profile[key]) });
    }
  }
  return draft;
}
