import assert from 'node:assert/strict';
import test from 'node:test';
import { getPromotionExpiration, isPromotionExpired } from './promotionDates.js';

test('a date-only promotion remains valid until the end of its local day', () => {
  const promo = { vigente_hasta: '2026-11-07' };
  assert.equal(isPromotionExpired(promo, new Date(2026, 10, 7, 23, 59, 59, 999)), false);
  assert.equal(isPromotionExpired(promo, new Date(2026, 10, 8, 0, 0)), true);
});

test('promotions without a valid end date are not treated as expired', () => {
  assert.equal(getPromotionExpiration({}), null);
  assert.equal(isPromotionExpired({ vigente_hasta: 'invalid' }), false);
});
