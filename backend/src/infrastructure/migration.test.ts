import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeParticipants } from '../domain/activity/participants.js';

test('finance JSON participants migrate without silent loss of named rows', () => {
  const json = [
    { name: 'Alice', title: 'Officer', phone: '0701', amount: 100, days: 3 },
    { name: 'Bob', amount: 0, days: 1 },
  ];
  const rows = sanitizeParticipants(json);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Alice');
  assert.equal(rows[1].name, 'Bob');
});

test('unnamed finance JSON rows are rejected rather than stored empty', () => {
  assert.throws(() => sanitizeParticipants([{ phone: '0701' }]), /name/);
});
