// Unit tests for catalog entry validation (node --test "scripts/test/*.test.mjs").
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSafeHttpsUrl, toEntry, validateEntry } from '../lib/entry.mjs';

const valid = {
  servicenow_ritm: 'RITM0010002',
  api_name: 'demo-policies',
  owner_group: 'team-demo',
  data_class: 'internal',
  backend_url_dev: 'https://dev.example.invalid/policies',
  backend_url_prod: 'https://prod.example.invalid/policies',
  description: 'Dummy API for the PoC',
};

test('accepts a valid entry', () => {
  assert.deepEqual(validateEntry(valid), []);
});

test('rejects http, credentials, localhost and IP backends', () => {
  for (const url of ['http://dev.example.invalid', 'https://user:pw@dev.example.invalid', 'https://localhost/x',
    'https://localhost./x', 'https://api.localhost/x', 'https://127.0.0.1/x', 'https://127.1/x', 'https://2130706433/x',
    'https://169.254.169.254/latest', 'https://10.0.0.5:8443/x', 'https://[::1]/x', 'javascript:alert(1)']) {
    assert.equal(isSafeHttpsUrl(url), false, url);
  }
  assert.equal(isSafeHttpsUrl('https://backend.example.com:8443/path?q=1'), true);
});

test('rejects bad names, unknown fields and wrong data class', () => {
  const errors = validateEntry({ ...valid, api_name: 'Bad_Name', extra: 'x', data_class: 'secret' });
  assert.equal(errors.length, 3);
});

test('rejects reserved names that collide with platform repositories or teams', () => {
  for (const name of ['catalog', 'template', 'platform']) {
    assert.ok(validateEntry({ ...valid, api_name: name }).includes('api_name is reserved'), name);
  }
  assert.ok(validateEntry({ ...valid, owner_group: 'platform-team' }).includes('owner_group is reserved'));
});

test('rejects command-like and path-like values', () => {
  assert.notDeepEqual(validateEntry({ ...valid, api_name: 'a;rm -rf' }), []);
  assert.notDeepEqual(validateEntry({ ...valid, owner_group: '../etc' }), []);
  assert.notDeepEqual(validateEntry({ ...valid, servicenow_ritm: 'RITM1' }), []);
});

test('rejects control characters and overlong descriptions', () => {
  assert.notDeepEqual(validateEntry({ ...valid, description: 'a\u0007b' }), []);
  assert.notDeepEqual(validateEntry({ ...valid, description: 'x'.repeat(501) }), []);
});

test('toEntry keeps only known fields and normalizes whitespace', () => {
  const entry = toEntry('RITM0010002', { ...valid, api_name: ' Demo-Policies ', description: 'line1\nline2', injected: 'x' });
  assert.equal(entry.api_name, 'demo-policies');
  assert.equal(entry.description, 'line1 line2');
  assert.equal('injected' in entry, false);
});
