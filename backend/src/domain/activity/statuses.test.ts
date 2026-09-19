import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, needsActivityReport, isEditableStatus, canReceiveReport } from './statuses.js';

test('official transitions match Finance plus draft submit', () => {
  assert.equal(canTransition('draft', 'planned'), true);
  assert.equal(canTransition('draft', 'closed'), false);
  assert.equal(canTransition('planned', 'ongoing'), true);
  assert.equal(canTransition('planned', 'closed'), false);
  assert.equal(canTransition('planned', 'completed'), false);
  assert.equal(canTransition('report_submitted', 'closed'), true);
  assert.equal(canTransition('closed', 'planned'), false);
});

test('drafts are not due and cannot receive a report', () => {
  assert.equal(needsActivityReport('draft', false), false);
  assert.equal(canReceiveReport('draft'), false);
  assert.equal(isEditableStatus('draft'), true);
  assert.equal(needsActivityReport('planned', false), true);
  assert.equal(needsActivityReport('planned', true), false);
  assert.equal(needsActivityReport('closed', false), false);
});
