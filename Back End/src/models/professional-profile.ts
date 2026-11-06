export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue; }

export const profileLists = ['experiencias', 'educacion', 'habilidades', 'idiomas',
  'certificaciones', 'proyectos', 'licencias', 'voluntariados', 'reconocimientos'] as const;
export const profileMaps = ['datosPersonales', 'perfilProfesional', 'preferenciasPrivacidad'] as const;
export const profileFields = [...profileMaps, ...profileLists, 'camposPendientesDeValidacion'] as const;

export type ProfileInput = Record<typeof profileMaps[number], JsonObject> &
  Record<typeof profileLists[number], JsonObject[]> & { camposPendientesDeValidacion: string[] };
export type ProfessionalProfile = ProfileInput & {
  userId: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
};
