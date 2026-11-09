import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePromotionPrice } from './promotionPrice.js';

test('accepts optional prices and amounts in soles without losing zero', () => {
    assert.equal(parsePromotionPrice(undefined), undefined);
    assert.equal(parsePromotionPrice(''), null);
    assert.equal(parsePromotionPrice(null), null);
    assert.equal(parsePromotionPrice('140.50'), 140.5);
    assert.equal(parsePromotionPrice(0), 0);
    assert.equal(parsePromotionPrice('9999999999.99'), 9999999999.99);
});

test('rejects invalid amounts before writing to the database', () => {
    for (const value of ['-1', '1.234', '1e3', '10000000000', 'NaN', {}, true]) {
        assert.throws(() => parsePromotionPrice(value), /precio/);
    }
});
