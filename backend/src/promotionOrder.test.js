import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePromotionStock, validatePromotionItem } from './promotionOrder.js';

test('stock accepts only nonnegative integers', () => {
    assert.equal(parsePromotionStock('0'), 0);
    assert.equal(parsePromotionStock('30'), 30);
    assert.equal(parsePromotionStock(undefined), undefined);
    for (const value of ['', '-1', '1.5', '1e2', null, 1000000000]) {
        assert.throws(() => parsePromotionStock(value), /stock/);
    }
});

test('promotion order uses server data and rejects expired, altered and unavailable offers', () => {
    const promo = { id: 3, titulo: 'Combo', precio: '140.00', stock: 3, activa: true, vigente_hasta: '2026-11-08' };
    const item = { id: 3, qty: 2, price: 140, name: 'Alterado' };
    assert.deepEqual(validatePromotionItem(item, promo, '2026-11-08'),
        { type: 'promotion', id: 3, name: 'Combo', price: 140, qty: 2 });
    assert.throws(() => validatePromotionItem(item, promo, '2026-11-09'), /venció/);
    assert.throws(() => validatePromotionItem({ ...item, price: 1 }, promo, '2026-11-08'), /precio/);
    assert.throws(() => validatePromotionItem({ ...item, qty: 4 }, promo, '2026-11-08'), /stock/);
    assert.throws(() => validatePromotionItem(item, { ...promo, activa: false }, '2026-11-08'), /disponible/);
    assert.throws(() => validatePromotionItem(item, { ...promo, precio: null }, '2026-11-08'), /disponible/);
});
