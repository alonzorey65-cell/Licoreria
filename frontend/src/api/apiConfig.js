const isGitHubPages = window.location.hostname.includes('github.io');

const defaultApiUrl = isGitHubPages 
  ? 'https://tu-backend-real.onrender.com/api' // Reemplaza con tu URL real de Render o Railway
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