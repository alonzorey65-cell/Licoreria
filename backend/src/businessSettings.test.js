import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBusinessSettings, parseBusinessSettings } from './businessSettings.js';

const settings = { businessName: '  Mi local ', openingHours: 'Todos los días', address: 'Calle 1', phone: '+51 123', mapUrl: 'https://maps.example/test', currency: 'PEN' };

test('validates, trims and returns the shared business details', () => {
    const row = parseBusinessSettings(settings);
    assert.deepEqual(formatBusinessSettings(row), { ...settings, businessName: 'Mi local' });
});

test('rejects invalid URLs, missing details, currencies and oversized values', () => {
    for (const change of [{ mapUrl: 'javascript:alert(1)' }, { businessName: ' ' }, { currency: 'BAD' }, { address: 'x'.repeat(201) }]) {
        assert.throws(() => parseBusinessSettings({ ...settings, ...change }));
    }
});
