import { apiUrl } from './apiConfig';
import { getSupabaseClient } from './supabaseClient';

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
  try {
    return await fetchCollection('licores', 'productos');
  } catch (backendError) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('licores').select('*');
      if (error) throw error;
      if (Array.isArray(data)) return data;
    } catch {
      // Si falla también Supabase, continúa para lanzar el error original
    }
    throw backendError;
  }
}

export async function fetchMesasAPI() {
  try {
    return await fetchCollection('mesas', 'mesas');
  } catch (backendError) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('mesas').select('*');
      if (error) throw error;
      if (Array.isArray(data)) return data;
    } catch {
      // Si falla también Supabase, continúa para lanzar el error original
    }
    throw backendError;
  }
}

export async function createReservaAPI(reservaData) {
  try {
    const res = await fetch(apiUrl('reservas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservaData)
    });
    if (res.ok) return await res.json();
  } catch (backendError) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('reservas').insert([reservaData]).select();
      if (error) throw error;
      if (data && data[0]) return data[0];
    } catch {
      throw backendError;
    }
  }
  throw new Error('Error al registrar reserva');
}