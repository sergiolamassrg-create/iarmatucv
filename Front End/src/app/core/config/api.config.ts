import { environment } from '../../../environments/environment';

export class ApiConfigurationError extends Error {
  constructor() {
    super('El servicio todavía no está habilitado. Volvé más tarde.');
  }
}

export function apiUrl(path: string): string {
  const base = environment.apiBaseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new ApiConfigurationError();
  if (environment.production) {
    let url: URL;
    try { url = new URL(base); }
    catch { throw new ApiConfigurationError(); }
    const host = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '[::1]' || host === '0.0.0.0') {
      throw new ApiConfigurationError();
    }
  }
  return `${base}/${path.replace(/^\/+/, '')}`;
}
