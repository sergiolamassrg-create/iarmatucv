import type { JsonObject, ListSection, ProfileInput } from './professional-profile';

export const cvSections: { key: 'resumen' | ListSection; label: string }[] = [
  { key: 'resumen', label: 'Perfil profesional' }, { key: 'experiencias', label: 'Experiencia laboral' },
  { key: 'educacion', label: 'Educación' }, { key: 'habilidades', label: 'Habilidades' },
  { key: 'idiomas', label: 'Idiomas' }, { key: 'certificaciones', label: 'Certificaciones' },
  { key: 'proyectos', label: 'Proyectos' }, { key: 'licencias', label: 'Licencias' },
  { key: 'voluntariados', label: 'Voluntariados' }, { key: 'reconocimientos', label: 'Reconocimientos' }
];
export type CvSectionKey = typeof cvSections[number]['key'];
export const cvTemplates = [
  { key: 'ats', name: 'ATS Clásica', description: 'Una columna, texto claro y prioridad al orden de lectura.' },
  { key: 'moderna', name: 'Profesional Moderna', description: 'Cabecera con iniciales y columna lateral. Algunos ATS pueden interpretar peor las columnas.' }
] as const;
export type CvTemplateKey = typeof cvTemplates[number]['key'];
export interface CvOptions {
  template: CvTemplateKey;
  order: CvSectionKey[];
  sections: Record<CvSectionKey, boolean>;
  email: boolean;
  phone: boolean;
  location: boolean;
  fullLocation: boolean;
  links: boolean;
}
export interface CvEntry { title: string; subtitle: string; dates: string; lines: string[]; }
export interface CvDocument {
  name: string;
  title: string;
  contact: string[];
  sections: { key: CvSectionKey; title: string; entries: CvEntry[] }[];
}

function text(object: JsonObject, key: string): string {
  return typeof object[key] === 'string' ? object[key].trim() : '';
}
function texts(object: JsonObject, key: string): string[] {
  const value = object[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()) : [];
}
function link(object: JsonObject, key: string): string {
  const value = text(object, key);
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : '';
  } catch { return ''; }
}
function dates(object: JsonObject): string {
  const end = object['actual'] === true ? 'Actualidad' : text(object, 'fechaFin');
  return [text(object, 'fechaInicio'), end].filter(Boolean).join(' — ') || text(object, 'fecha');
}
function entry(item: JsonObject, section: ListSection): CvEntry {
  const titles: Record<ListSection, string[]> = {
    experiencias: ['puesto', 'empresa'], educacion: ['titulo', 'institucion'], habilidades: ['nombre'],
    idiomas: ['idioma'], certificaciones: ['nombre', 'titulo'], proyectos: ['nombre'],
    licencias: ['nombre'], voluntariados: ['rol', 'organizacion'], reconocimientos: ['nombre', 'descripcion']
  };
  const title = titles[section].map(key => text(item, key)).find(Boolean) ?? '';
  const subtitle = (section === 'experiencias' ? ['empresa'] : section === 'educacion' ? ['institucion', 'nivel', 'estado'] :
    section === 'idiomas' ? ['nivel', 'estado'] : section === 'habilidades' ? ['categoria', 'nivel'] :
    section === 'proyectos' ? ['rol', 'tipo'] : ['emisor', 'organizacion'])
    .map(key => text(item, key)).filter(value => value && value !== title).map(value => value.replace(/_/g, ' ')).join(' · ');
  const description = text(item, 'descripcion');
  const technologies = texts(item, 'tecnologias');
  return { title, subtitle, dates: dates(item), lines: [description !== title ? description : '',
    ...texts(item, 'responsabilidades'), ...texts(item, 'logros').map(value => `Logro: ${value}`),
    technologies.length ? `Tecnologías: ${technologies.join(', ')}` : '', link(item, 'url')].filter(Boolean) };
}

export function defaultCvOptions(profile: ProfileInput): CvOptions {
  return { template: 'ats', order: cvSections.map(section => section.key),
    sections: Object.fromEntries(cvSections.map(section => [section.key, true])) as CvOptions['sections'],
    email: true, phone: profile.preferenciasPrivacidad['mostrarTelefono'] === true,
    location: true, fullLocation: profile.preferenciasPrivacidad['mostrarUbicacionCompleta'] === true, links: true };
}

export function orderedCvSections(options: CvOptions): typeof cvSections {
  const keys = [...new Set([...(options.order ?? []), ...cvSections.map(section => section.key)])];
  return keys.flatMap(key => cvSections.filter(section => section.key === key));
}

export function cvHref(value: string): string | null {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    return null;
  } catch {}
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value)) return `mailto:${encodeURIComponent(value).replace('%40', '@')}`;
  if (/^\+?[\d().\s-]{5,30}$/.test(value) && value.replace(/\D/g, '').length >= 5) return `tel:${value.replace(/[^\d+]/g, '')}`;
  return null;
}

export function cvExportIssues(profile: ProfileInput): string[] {
  const issues: string[] = [];
  if (!text(profile.datosPersonales, 'nombre')) issues.push('Completá tu nombre para exportar.');
  if (!text(profile.datosPersonales, 'apellido')) issues.push('Completá tu apellido para exportar.');
  return issues;
}

export function buildCvDocument(profile: ProfileInput, options: CvOptions): CvDocument {
  const personal = profile.datosPersonales;
  const place = personal['ubicacion'];
  const location = place && typeof place === 'object' && !Array.isArray(place) ? place : {};
  const result: CvDocument = {
    name: [text(personal, 'nombre'), text(personal, 'apellido')].filter(Boolean).join(' '),
    title: text(profile.perfilProfesional, 'titulo'),
    contact: [options.email ? text(personal, 'email') : '', options.phone ? text(personal, 'telefono') : '',
      options.location ? (options.fullLocation ? ['ciudad', 'provincia', 'pais'] : ['pais']).map(key => text(location, key)).filter(Boolean).join(', ') : '',
      ...(options.links ? ['linkedin', 'github', 'portfolio'].map(key => link(personal, key)) : [])].filter(Boolean),
    sections: []
  };
  for (const section of orderedCvSections(options)) {
    if (!options.sections[section.key]) continue;
    const summary = text(profile.perfilProfesional, 'resumen');
    const entries = section.key === 'resumen' ? (summary ? [{ title: '', subtitle: '', dates: '', lines: [summary] }] : []) :
      profile[section.key].map(item => entry(item, section.key as ListSection)).filter(item => item.title || item.subtitle || item.lines.length);
    if (entries.length) result.sections.push({ key: section.key, title: section.label, entries });
  }
  return result;
}

export function profileProgress(profile: ProfileInput) {
  const document = buildCvDocument(profile, defaultCvOptions(profile));
  const has = (key: CvSectionKey) => document.sections.some(section => section.key === key);
  const steps = [!cvExportIssues(profile).length, Boolean(text(profile.perfilProfesional, 'titulo') && text(profile.perfilProfesional, 'resumen')),
    has('experiencias'), has('educacion'), has('habilidades'),
    ['idiomas', 'certificaciones', 'proyectos', 'licencias', 'voluntariados', 'reconocimientos'].some(key => has(key as CvSectionKey))];
  const completed = steps.filter(Boolean).length;
  return { steps, completed, percent: Math.round(completed / steps.length * 100) };
}
