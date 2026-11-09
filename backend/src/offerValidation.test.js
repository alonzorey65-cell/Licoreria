import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOffer } from './offerValidation.js';

test('validates and normalizes promotional codes', () => {
    const promo = parseOffer('promo', { code: ' promo-1 ', discountType: 'percent', discountValue: '20', currency: 'pen', maxRedemptions: '', expiresAt: '', active: false });
    assert.equal(promo.code, 'PROMO-1');
    assert.equal(promo.discount_value, 20);
    assert.equal(promo.currency, 'PEN');
    assert.equal(promo.active, false);
    assert.equal(promo.max_redemptions, null);
    assert.throws(() => parseOffer('promo', { code: 'PROMO', discountType: 'percent', discountValue: 101, currency: 'USD' }));
    assert.throws(() => parseOffer('promo', { code: 'PROMO', discountType: 'fixed', discountValue: 5, maxRedemptions: 1.5 }));
});

test('allows an empty balance only when editing a gift card', () => {
    const gift = { code: 'REGALO-1', balance: '0', currency: 'USD' };
    assert.throws(() => parseOffer('gift-card', gift));
    assert.equal(parseOffer('gift-card', gift, true).balance, 0);
    assert.throws(() => parseOffer('gift-card', { ...gift, balance: '' }, true));
    assert.throws(() => parseOffer('gift-card', { ...gift, balance: -1 }, true));
});

test('rejects invalid expiry dates, status and kinds', () => {
    const gift = { code: 'REGALO-1', balance: 5 };
    assert.throws(() => parseOffer('gift-card', { ...gift, expiresAt: 'bad-date' }));
    assert.throws(() => parseOffer('gift-card', { ...gift, active: 'false' }));
    assert.throws(() => parseOffer('other', gift));
});
