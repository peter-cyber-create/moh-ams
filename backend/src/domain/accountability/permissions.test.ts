import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Actor } from '../activity/permissions.js';
import { ACC_PERMISSIONS, accountabilityPermissionsFor, canDecideAsReviewer } from './permissions.js';

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };
const reviewer: Actor = { id: 'u3', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };
const ict: Actor = { id: 'u2', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };

test('officer can create and submit but cannot approve', () => {
  const perms = accountabilityPermissionsFor(officer);
  assert.equal(perms.has(ACC_PERMISSIONS.CREATE), true);
  assert.equal(perms.has(ACC_PERMISSIONS.SUBMIT), true);
  assert.equal(perms.has(ACC_PERMISSIONS.APPROVE), false);
});

test('reviewer can review and assign but cannot create', () => {
  const perms = accountabilityPermissionsFor(reviewer);
  assert.equal(perms.has(ACC_PERMISSIONS.REVIEW), true);
  assert.equal(perms.has(ACC_PERMISSIONS.ASSIGN), true);
  assert.equal(perms.has(ACC_PERMISSIONS.CREATE), false);
});

test('ICT has no accountability permissions', () => {
  assert.equal(accountabilityPermissionsFor(ict).size, 0);
});

test('only the assigned reviewer can decide', () => {
  assert.equal(canDecideAsReviewer(reviewer, reviewer.id), true);
  assert.equal(canDecideAsReviewer(reviewer, 'someone-else'), false);
  assert.equal(canDecideAsReviewer(officer, reviewer.id), false);
});
