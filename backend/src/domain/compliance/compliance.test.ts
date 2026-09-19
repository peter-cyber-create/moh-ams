import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inclusiveCalendarDays, thresholdStatus, activityDuration } from './participation.js';
import { isPendingAccountability, isOverdueAccountability } from './accountability.js';
import { normalizePhone, participantIdentity } from './identity.js';
import { canViewCompliance } from './permissions.js';
import type { Actor } from '../activity/permissions.js';

test('inclusive duration is end - start + 1', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-02-09T00:00:00.000Z');
  assert.equal(inclusiveCalendarDays(start, end), 40);
  assert.equal(activityDuration({ activityDate: start, endDate: end }).days, 40);
  assert.equal(activityDuration({ activityDate: start, endDate: start }).days, 1);
  assert.equal(activityDuration({ activityDate: start, endDate: new Date('2025-12-31T00:00:00.000Z') }).days, null);
});

test('duration provenance distinguishes date-calculated, legacy stored days, defaulted, and needs review', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-01-05T00:00:00.000Z');
  const dated = activityDuration({ activityDate: start, endDate: end });
  assert.equal(dated.provenance, 'DATE_CALCULATED');
  assert.equal(dated.days, 5);
  const legacy = activityDuration({ activityDate: start, endDate: null, days: 12 });
  assert.equal(legacy.provenance, 'LEGACY_STORED_DAYS');
  assert.equal(legacy.days, 12);
  const def = activityDuration({ activityDate: start, endDate: null, days: null });
  assert.equal(def.provenance, 'DEFAULTED');
  assert.equal(def.days, 1);
  const missing = activityDuration({ activityDate: null, endDate: null });
  assert.equal(missing.provenance, 'NEEDS_REVIEW');
  const cross = activityDuration({
    activityDate: new Date('2026-12-30T00:00:00.000Z'),
    endDate: new Date('2027-01-02T00:00:00.000Z'),
  });
  assert.equal(cross.crossYear, true);
  assert.ok(cross.issues.includes('CROSS_YEAR_REVIEW'));
});

test('150-day interpretation flags exactly 150 and above', () => {
  assert.equal(thresholdStatus(149), 'within_limit');
  assert.equal(thresholdStatus(150), 'threshold_reached');
  assert.equal(thresholdStatus(151), 'exceeded');
});

test('pending accountability is not every non-closed status', () => {
  assert.equal(isPendingAccountability('draft'), false);
  assert.equal(isPendingAccountability('submitted'), true);
  assert.equal(isPendingAccountability('returned'), true);
  assert.equal(isPendingAccountability('clarification_requested'), true);
  assert.equal(isPendingAccountability('approved'), false);
  assert.equal(isPendingAccountability('closed'), false);
  assert.equal(isPendingAccountability('rejected'), false);
  const past = new Date('2020-01-01');
  assert.equal(isOverdueAccountability('under_review', past), true);
  assert.equal(isOverdueAccountability('closed', past), false);
  assert.equal(isOverdueAccountability('draft', past), false);
});

test('identity normalizes phone and name case without merging phone and name-only', () => {
  assert.equal(normalizePhone('0700123456'), '256700123456');
  assert.equal(participantIdentity('JOHN DOE', '0700123456').key, participantIdentity('John Doe', '+256700123456').key);
  assert.notEqual(participantIdentity('John Doe', '0700123456').key, participantIdentity('John Doe', '').key);
});

test('ICT cannot view compliance; reviewer can', () => {
  const ict: Actor = { id: 'i', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };
  const reviewer: Actor = { id: 'r', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };
  assert.equal(canViewCompliance(ict), false);
  assert.equal(canViewCompliance(reviewer), true);
});
