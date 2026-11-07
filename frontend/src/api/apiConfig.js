// Detecta automáticamente si estamos en GitHub Pages o en local
const isGitHubPages = window.location.hostname.includes('github.io');

// Si está en producción, usa tu backend real en Render; si estás en tu PC, usa localhost
const defaultApiUrl = isGitHubPages 
  ? 'https://tu-backend-real.onrender.com/api' // <-- Reemplaza esto con la URL real de tu servicio en Render (ej. https://licoreria-backend.onrender.com/api)
  : 'http://localhost:5000/api';

const configuredApiUrl = import.meta.env.VITE_API_URL || defaultApiUrl;

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/i, '');

export function apiUrl(path) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

export function apiAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}