import { getSupabaseClient } from './supabaseClient';

export async function adminFetch(url, options = {}) {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('La sesión administrativa expiró. Inicia sesión de nuevo.');

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}

export async function adminRequest(url, method = 'GET', body) {
  const response = await adminFetch(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `La operación falló (${response.status}).`);
  return result;
}
