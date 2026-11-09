import assert from 'node:assert/strict';
import test from 'node:test';
import { getPromotionExpiration, isPromotionExpired } from './promotionDates.js';

test('a date-only promotion remains valid until the end of its day in Peru', () => {
  const promo = { vigente_hasta: '2026-11-07' };
  assert.equal(isPromotionExpired(promo, new Date('2026-11-08T04:59:59.999Z')), false);
  assert.equal(isPromotionExpired(promo, new Date('2026-11-08T05:00:00.000Z')), true);
});

test('promotions without a valid end date are not treated as expired', () => {
  assert.equal(getPromotionExpiration({}), null);
  assert.equal(isPromotionExpired({ vigente_hasta: 'invalid' }), false);
});
