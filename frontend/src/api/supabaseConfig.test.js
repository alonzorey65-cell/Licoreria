import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupabaseConfig } from './supabaseConfig.js';

test('prefers the backend public configuration over frontend variables', async () => {
  const config = await resolveSupabaseConfig('/api/public-config', {
    url: 'https://placeholder.example',
    key: 'wrong'
  }, async () => ({
    ok: true,
    json: async () => ({ supabaseUrl: 'https://project.supabase.co', publishableKey: 'public-key' })
  }));
  assert.deepEqual(config, { url: 'https://project.supabase.co', key: 'public-key' });
});

test('uses frontend configuration when the backend fails', async () => {
  const env = { url: 'https://project.supabase.co', key: 'public-key' };
  const config = await resolveSupabaseConfig('/api/public-config', env, async () => {
    throw new Error('Network error');
  });
  assert.deepEqual(config, env);
});

test('reports failure when neither configuration is usable', async () => {
  await assert.rejects(
    resolveSupabaseConfig('/api/public-config', { url: '', key: '' }, async () => ({ ok: false, status: 503 })),
    /No se pudo conectar con el servidor/
  );
});
