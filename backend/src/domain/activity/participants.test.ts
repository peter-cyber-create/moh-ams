import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAG_DAY_THRESHOLD, flaggedParticipants, sanitizeParticipants } from './participants.js';

test('participant sanitization rejects malformed rows', () => {
  assert.deepEqual(sanitizeParticipants(null), []);
  assert.throws(() => sanitizeParticipants({}), /list/);
  assert.throws(() => sanitizeParticipants([{ title: 'x' }]), /name/);
});

test('JSON migration mapping preserves name title phone amount days', () => {
  const rows = sanitizeParticipants([{ name: ' Jane ', title: 'Dr', phone: '0701', amount: '10', days: '2' }]);
  assert.equal(rows[0].name, 'Jane');
  assert.equal(rows[0].amount, 10);
  assert.equal(rows[0].days, 2);
});

test('150-day flag uses relational participant days', () => {
  assert.equal(FLAG_DAY_THRESHOLD, 150);
  const flagged = flaggedParticipants([
    { name: 'A', phone: '0701', days: 80, amount: 1 },
    { name: 'A', phone: '0701', days: 80, amount: 2 },
    { name: 'B', phone: '0702', days: 10, amount: 3 },
  ]);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].totalDays, 160);
});
