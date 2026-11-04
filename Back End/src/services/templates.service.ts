import { getAllTemplates } from '../repositories/templates.repository.js';

export function getTemplates() {
  return getAllTemplates();
}
