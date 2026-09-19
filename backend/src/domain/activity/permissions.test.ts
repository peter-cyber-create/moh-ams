import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, hasPermission, permissionsFor, type Actor } from './permissions.js';

const officer: Actor = { id: 'o', email: 'f@x', name: 'F', module: 'Finance', roleName: 'User', isActive: true };
const ict: Actor = { id: 'i', email: 'i@x', name: 'I', module: 'ICT', roleName: 'User', isActive: true };
const reviewer: Actor = { id: 'r', email: 'r@x', name: 'R', module: 'Finance', roleName: 'Reviewer', isActive: true };
const admin: Actor = { id: 'a', email: 'a@x', name: 'A', module: 'Admin', roleName: 'Admin', isActive: true };

test('ICT cannot access activity permissions', () => {
  assert.equal(permissionsFor(ict).size, 0);
  assert.equal(hasPermission(ict, PERMISSIONS.VIEW), false);
});

test('officer can create and report but not close or view all', () => {
  assert.equal(hasPermission(officer, PERMISSIONS.CREATE), true);
  assert.equal(hasPermission(officer, PERMISSIONS.REPORT), true);
  assert.equal(hasPermission(officer, PERMISSIONS.CLOSE), false);
  assert.equal(hasPermission(officer, PERMISSIONS.VIEW_ALL), false);
});

test('reviewer can close and view all', () => {
  assert.equal(hasPermission(reviewer, PERMISSIONS.VIEW_ALL), true);
  assert.equal(hasPermission(reviewer, PERMISSIONS.CLOSE), true);
  assert.equal(hasPermission(reviewer, PERMISSIONS.CREATE), false);
});

test('admin has manage', () => {
  assert.equal(hasPermission(admin, PERMISSIONS.MANAGE), true);
  assert.equal(hasPermission(admin, PERMISSIONS.CREATE), true);
});
