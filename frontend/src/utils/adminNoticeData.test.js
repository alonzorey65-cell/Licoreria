import assert from 'node:assert/strict';
import test from 'node:test';
import { countNewAdminNotices, getAdminNoticeIds } from './adminNoticeData.js';

test('only includes pending alerts that the role can access', () => {
  const result = getAdminNoticeIds({ reservas: true, ayuda: false, alertas: true },
    [{ id: 1, status: 'Recibido' }, { id: 2, status: 'Entregado' }],
    [{ id: 3, status: 'pendiente' }],
    [{ id: 4, stock: 5 }, { id: 5, stock: 6 }]);
  assert.deepEqual(result, ['1', '', '4']);
});

test('counts newly appearing alerts without repeating existing ones', () => {
  const previous = [new Set(['1']), new Set(['3']), new Set()];
  const current = [new Set(['1', '2']), new Set(['3']), new Set(['4'])];
  assert.deepEqual(countNewAdminNotices(current, previous), [1, 0, 1]);
});
