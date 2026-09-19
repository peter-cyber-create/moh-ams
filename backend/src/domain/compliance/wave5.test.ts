import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONTHLY_FIELD_DAY_LIMIT, monthlyStatus } from './monthly.js';
import {
  ANNUAL_EARLY_WARNING_THRESHOLD,
  annualWarningStatus,
  isEarlyWarning,
  isNearLimit,
  thresholdStatus,
} from './participation.js';
import { dateRangesOverlap, findConfirmedOverlaps, findPotentialNameOverlaps, overlapPeriod } from './overlap.js';
import { monthlyFlags, participationFlags, warningMessages } from './flags.js';

test('monthly 20-day limit: under, exactly 20, and over', () => {
  assert.equal(MONTHLY_FIELD_DAY_LIMIT, 20);
  assert.equal(monthlyStatus(19), 'within_limit');
  assert.equal(monthlyStatus(20), 'limit_reached');
  assert.equal(monthlyStatus(21), 'exceeded');
  assert.deepEqual(monthlyFlags('limit_reached'), ['MONTHLY_LIMIT_REACHED']);
  assert.deepEqual(monthlyFlags('exceeded'), ['MONTHLY_LIMIT_EXCEEDED']);
});

test('120-day early warning is distinct from near-limit and threshold', () => {
  assert.equal(ANNUAL_EARLY_WARNING_THRESHOLD, 120);
  assert.equal(isEarlyWarning(119), false);
  assert.equal(isEarlyWarning(120), true);
  assert.equal(isEarlyWarning(149), true);
  assert.equal(isEarlyWarning(150), false);
  assert.equal(annualWarningStatus(119), 'normal');
  assert.equal(annualWarningStatus(120), 'early_warning');
  assert.equal(annualWarningStatus(150), 'threshold_reached');
  assert.equal(annualWarningStatus(151), 'exceeded');
  assert.equal(thresholdStatus(150), 'threshold_reached');
  assert.equal(thresholdStatus(151), 'exceeded');
  assert.equal(isNearLimit(135), true);
  assert.equal(isNearLimit(120), false);
  assert.deepEqual(participationFlags('within_limit', false, true), ['EARLY_WARNING']);
  assert.deepEqual(participationFlags('within_limit', true, true), ['EARLY_WARNING', 'NEAR_LIMIT']);
});

test('date range overlap detection', () => {
  const a = { start: new Date('2026-09-01T00:00:00.000Z'), end: new Date('2026-09-10T00:00:00.000Z') };
  const b = { start: new Date('2026-09-05T00:00:00.000Z'), end: new Date('2026-09-15T00:00:00.000Z') };
  const c = { start: new Date('2026-09-11T00:00:00.000Z'), end: new Date('2026-09-20T00:00:00.000Z') };
  assert.equal(dateRangesOverlap(a, b), true);
  assert.equal(dateRangesOverlap(a, c), false);
  const period = overlapPeriod(a, b);
  assert.equal(period?.start.toISOString().slice(0, 10), '2026-09-05');
  assert.equal(period?.end.toISOString().slice(0, 10), '2026-09-10');
});

test('confirmed overlap requires same personId; name-only is potential only', () => {
  const startA = new Date('2026-09-01T00:00:00.000Z');
  const endA = new Date('2026-09-10T00:00:00.000Z');
  const startB = new Date('2026-09-05T00:00:00.000Z');
  const endB = new Date('2026-09-15T00:00:00.000Z');
  const confirmed = findConfirmedOverlaps([
    { activityId: 'a1', title: 'A', referenceNumber: null, start: startA, end: endA, personId: 'p1', personName: 'D' },
    { activityId: 'a2', title: 'B', referenceNumber: null, start: startB, end: endB, personId: 'p1', personName: 'D' },
    { activityId: 'a3', title: 'C', referenceNumber: null, start: startB, end: endB, personId: 'p2', personName: 'Other' },
  ]);
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].kind, 'OVERLAP_DETECTED');
  const potential = findPotentialNameOverlaps([
    {
      activityId: 'a1',
      title: 'A',
      referenceNumber: null,
      start: startA,
      end: endA,
      personId: null,
      personName: 'Pat',
      normalizedName: 'pat',
    },
    {
      activityId: 'a2',
      title: 'B',
      referenceNumber: null,
      start: startB,
      end: endB,
      personId: null,
      personName: 'Pat',
      normalizedName: 'pat',
    },
  ]);
  assert.equal(potential.length, 1);
  assert.equal(potential[0].kind, 'POTENTIAL_PARTICIPANT_OVERLAP');
});

test('warning messages cover annual monthly overlap and accountability', () => {
  const msgs = warningMessages({
    name: 'John Doe',
    year: 2026,
    monthLabel: 'August 2026',
    annualDays: 125,
    earlyWarning: true,
    thresholdStatus: 'within_limit',
    monthlyStatus: 'exceeded',
    overlap: true,
    overdue: true,
  });
  assert.ok(msgs.some((m) => /120|approaching|125/.test(m)));
  assert.ok(msgs.some((m) => /20-day field limit for August 2026/.test(m)));
  assert.ok(msgs.some((m) => /already assigned/.test(m)));
  assert.ok(msgs.some((m) => /overdue accountability/.test(m)));
});
