import type { CvTemplate } from '../models/cv-template.js';

const templates: CvTemplate[] = [
  { slug: 'clasica', name: 'Clásica moderna', description: 'Un diseño equilibrado que le da protagonismo a tu experiencia.', label: 'Versátil' },
  { slug: 'dark', name: 'Dark tech', description: 'Contrastes y acentos para un perfil con personalidad propia.', label: 'Tecnología' },
  { slug: 'minimalista', name: 'Minimalista', description: 'Solo lo esencial, con espacio para que tu recorrido hable.', label: 'Esencial' },
  { slug: 'creativa', name: 'Creativa', description: 'Un toque de color para mostrar tu lado más creativo.', label: 'Con carácter' },
  { slug: 'pastel', name: 'Pastel', description: 'Tonos suaves y una presentación cercana, fresca y ordenada.', label: 'Fresca' },
  { slug: 'profesional', name: 'Profesional', description: 'Una estructura sobria para contar tu recorrido con claridad.', label: 'Atemporal' }
];

export function getAllTemplates(): CvTemplate[] {
  return templates;
}
