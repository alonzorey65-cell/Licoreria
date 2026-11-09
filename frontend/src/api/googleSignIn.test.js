import test from 'node:test';
import assert from 'node:assert/strict';
import { googleSignInOptions } from './googleSignIn.js';

test('permite elegir otra cuenta y conserva la ruta de despliegue', () => {
  assert.deepEqual(googleSignInOptions({
    origin: 'https://example.test',
    pathname: '/Licoreria/',
    search: '?mesa=2',
    hash: '#account'
  }), {
    provider: 'google',
    options: {
      redirectTo: 'https://example.test/Licoreria/',
      queryParams: { prompt: 'select_account' }
    }
  });
});
