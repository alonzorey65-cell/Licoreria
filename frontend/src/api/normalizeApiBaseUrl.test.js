import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeApiBaseUrl } from './normalizeApiBaseUrl.js';

test('adds the API path to a backend origin', () => {
  assert.equal(normalizeApiBaseUrl('https://example.com'), 'https://example.com/api');
  assert.equal(normalizeApiBaseUrl(' https://example.com:5000/ '), 'https://example.com:5000/api');
});

test('preserves configured API paths and relative URLs', () => {
  assert.equal(normalizeApiBaseUrl('https://example.com/api/'), 'https://example.com/api');
  assert.equal(normalizeApiBaseUrl('https://example.com/custom/api'), 'https://example.com/custom/api');
  assert.equal(normalizeApiBaseUrl('/api/'), '/api');
  assert.equal(normalizeApiBaseUrl('http://localhost:5000/api'), 'http://localhost:5000/api');
});
