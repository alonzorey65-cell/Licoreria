import { createClient } from '@supabase/supabase-js';
import { apiUrl } from './apiConfig';
import { resolveSupabaseConfig } from './supabaseConfig';

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
      const { url, key } = await resolveSupabaseConfig(apiUrl('public-config'), {
        url: import.meta.env.VITE_SUPABASE_URL,
        key: import.meta.env.VITE_SUPABASE_ANON_KEY
      });
      return createClient(url, key);
    })().catch(error => {
      supabaseClientPromise = null;
      throw error;
    });
  }

  return supabaseClientPromise;
}
