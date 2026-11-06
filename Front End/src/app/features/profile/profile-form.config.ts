import type { ProfileField } from './profile-fields.component';
import type { ListSection } from '../../core/models/professional-profile';

const field = (key: string, label: string, type: ProfileField['type'] = 'text'): ProfileField => ({ key, label, type });
const dates = [field('fechaInicio', 'Fecha de inicio (año o fecha)'), field('fechaFin', 'Fecha de finalización (si corresponde)')];
export const personalFields = [field('nombre', 'Nombre'), field('apellido', 'Apellido'), field('nombreProfesional', 'Nombre profesional'),
  field('email', 'Correo de contacto', 'email'), field('telefono', 'Teléfono'), field('ubicacion.ciudad', 'Ciudad'),
  field('ubicacion.provincia', 'Provincia'), field('ubicacion.pais', 'País'), field('linkedin', 'LinkedIn', 'url'),
  field('github', 'GitHub', 'url'), field('portfolio', 'Portfolio', 'url')];
export const professionalFields = [field('titulo', 'Título profesional'), field('disponibilidad', 'Disponibilidad'),
  field('resumen', 'Resumen profesional', 'textarea'), field('puestosObjetivo', 'Puestos que te interesan', 'list'),
  field('modalidadesPreferidas', 'Modalidades preferidas', 'list')];
export const privacyFields = [field('mostrarTelefono', 'Mostrar teléfono', 'checkbox'), field('mostrarUbicacionCompleta', 'Mostrar ubicación completa', 'checkbox')];
export const pendingFields = [field('camposPendientesDeValidacion', 'Datos que querés revisar', 'list')];
export const repeatSections: { key: ListSection; title: string; singular: string; fields: ProfileField[] }[] = [
  { key: 'experiencias', title: 'Experiencia laboral', singular: 'experiencia', fields: [field('empresa', 'Empresa'), field('puesto', 'Puesto'),
    ...dates, field('actual', 'Trabajo actualmente acá', 'checkbox'), field('ubicacion.ciudad', 'Ciudad'), field('ubicacion.pais', 'País'),
    field('responsabilidades', 'Responsabilidades', 'list'), field('logros', 'Logros', 'list'), field('tecnologias', 'Tecnologías', 'list')] },
  { key: 'educacion', title: 'Educación', singular: 'estudio', fields: [field('institucion', 'Institución'), field('titulo', 'Título'),
    field('nivel', 'Nivel educativo'), field('estado', 'Estado (por ejemplo: en_curso)'), ...dates] },
  { key: 'habilidades', title: 'Habilidades', singular: 'habilidad', fields: [field('nombre', 'Habilidad'), field('categoria', 'Categoría'), field('nivel', 'Nivel')] },
  { key: 'idiomas', title: 'Idiomas', singular: 'idioma', fields: [field('idioma', 'Idioma'), field('nivel', 'Nivel'), field('estado', 'Estado de formación')] },
  { key: 'certificaciones', title: 'Certificaciones', singular: 'certificación', fields: [field('nombre', 'Certificación'), field('emisor', 'Entidad emisora'), ...dates, field('url', 'Enlace de verificación', 'url')] },
  { key: 'proyectos', title: 'Proyectos', singular: 'proyecto', fields: [field('nombre', 'Proyecto'), field('tipo', 'Tipo'), field('rol', 'Tu rol'), ...dates,
    field('descripcion', 'Descripción', 'textarea'), field('tecnologias', 'Tecnologías', 'list'), field('url', 'Enlace', 'url')] },
  { key: 'licencias', title: 'Licencias', singular: 'licencia', fields: [field('nombre', 'Licencia'), field('emisor', 'Entidad emisora'), ...dates, field('descripcion', 'Descripción', 'textarea')] },
  { key: 'voluntariados', title: 'Voluntariados', singular: 'voluntariado', fields: [field('organizacion', 'Organización'), field('rol', 'Tu rol'), ...dates, field('descripcion', 'Descripción', 'textarea')] },
  { key: 'reconocimientos', title: 'Reconocimientos', singular: 'reconocimiento', fields: [field('nombre', 'Reconocimiento'), field('emisor', 'Entidad'), ...dates, field('descripcion', 'Descripción', 'textarea')] }
];
