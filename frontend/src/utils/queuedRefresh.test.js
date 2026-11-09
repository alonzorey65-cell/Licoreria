import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueuedRefresh } from './queuedRefresh.js';

test('agrupa solicitudes concurrentes y espera una actualización posterior', async () => {
  const resolvers = [];
  const refresh = createQueuedRefresh(() => new Promise(resolve => resolvers.push(resolve)));
  const first = refresh();
  await Promise.resolve();
  const second = refresh();
  const third = refresh();
  assert.equal(second, third);
  resolvers[0](true);
  assert.equal(await first, true);
  await Promise.resolve();
  assert.equal(resolvers.length, 2);
  resolvers[1](false);
  assert.equal(await second, false);
  assert.equal(await third, false);
});

test('una carga fallida no bloquea la siguiente', async () => {
  let attempts = 0;
  const refresh = createQueuedRefresh(() => {
    attempts += 1;
    if (attempts === 1) throw new Error('sin conexión');
    return true;
  });
  const first = refresh();
  const next = refresh();
  await assert.rejects(first, /sin conexión/);
  assert.equal(await next, true);
  assert.equal(attempts, 2);
});
