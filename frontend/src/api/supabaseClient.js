import { createClient } from '@supabase/supabase-js';
import { apiUrl } from './apiConfig';

let supabaseClientPromise;

export function hasVerifiedCustomerIdentity(user) {
  const hasGoogleIdentity = user?.app_metadata?.provider === 'google'
    || user?.app_metadata?.providers?.includes('google');
  return Boolean(
    (hasGoogleIdentity && user?.email && user.email_confirmed_at)
    || (user?.phone && user.phone_confirmed_at)
  );
}

export function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = (async () => {
      const envUrl = import.meta.env.VITE_SUPABASE_URL;
      const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (envUrl && envKey) {
        return createClient(envUrl, envKey);
      }

      const response = await fetch(apiUrl('public-config'));
      if (!response.ok) {
        throw new Error(`La configuración pública de Supabase respondió ${response.status}.`);
      }

      const { supabaseUrl, publishableKey } = await response.json();
      if (!supabaseUrl || !publishableKey) {
        throw new Error('Falta la URL o la clave publicable de Supabase.');
      }

      return createClient(supabaseUrl, publishableKey);
    })().catch(error => {
      supabaseClientPromise = null;
      throw error;
    });
  }

  return supabaseClientPromise;
}
