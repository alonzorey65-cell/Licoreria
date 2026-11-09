import { apiUrl } from './apiConfig';

async function fetchCollection(path, label) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    throw new Error(result.error || `Error al cargar ${label} (${res.status}).`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`La respuesta de ${label} no tiene el formato esperado.`);
  return data;
}

export async function fetchLicoresAPI() {
  return fetchCollection('licores', 'productos');
}

export async function fetchMesasAPI() {
  return fetchCollection('mesas', 'mesas');
}
