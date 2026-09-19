import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNTABILITY_DUE_DAYS,
  canTransitionAccountability,
  defaultDueDate,
  formatReference,
  isOverdue,
} from './statuses.js';

test('returned, clarification_requested and rejected are distinct transitions from under_review', () => {
  assert.equal(canTransitionAccountability('under_review', 'returned'), true);
  assert.equal(canTransitionAccountability('under_review', 'clarification_requested'), true);
  assert.equal(canTransitionAccountability('under_review', 'rejected'), true);
  assert.equal(canTransitionAccountability('under_review', 'closed'), false);
  assert.equal(canTransitionAccountability('approved', 'closed'), true);
  assert.equal(canTransitionAccountability('closed', 'under_review'), false);
});

test('reference numbers are human-readable and padded', () => {
  assert.equal(formatReference(2026, 1), 'ACC-2026-000001');
});

test('due date defaults to ACCOUNTABILITY_DUE_DAYS and overdue ignores settled statuses', () => {
  assert.equal(ACCOUNTABILITY_DUE_DAYS, 60);
  const from = new Date('2026-01-01T00:00:00.000Z');
  const due = defaultDueDate(from);
  assert.equal(due.toISOString(), '2026-03-02T00:00:00.000Z');
  assert.equal(isOverdue(new Date('2020-01-01'), 'draft'), true);
  assert.equal(isOverdue(new Date('2020-01-01'), 'closed'), false);
  assert.equal(isOverdue(new Date('2020-01-01'), 'approved'), false);
  assert.equal(isOverdue(new Date('2020-01-01'), 'rejected'), false);
});
