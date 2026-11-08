const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');

const isLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(API_BASE_URL);
const isLocalPage = ['localhost', '127.0.0.1'].includes(window.location.hostname);
// En producción, localhost apunta al propio dispositivo del visitante.
export const API_MISCONFIGURED = isLocalApi && !isLocalPage;
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/i, '');

export function apiUrl(path) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

export function apiAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
