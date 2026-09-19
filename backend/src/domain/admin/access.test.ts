import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_MATRIX,
  accessRoleByKey,
  hasAdminPermission,
  ADMIN_PERMISSIONS,
  inferAccessRole,
  isAmsAdministrator,
} from './access.js';
import type { Actor } from '../activity/permissions.js';

const admin: Actor = { id: 'a1', email: 'a@x', name: 'Admin', module: 'Admin', roleName: 'Admin', isActive: true };
const officer: Actor = { id: 'o1', email: 'o@x', name: 'Off', module: 'Finance', roleName: 'Officer', isActive: true };
const reviewer: Actor = { id: 'r1', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };
const ict: Actor = { id: 'i1', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };

test('administrator detection and admin permission', () => {
  assert.equal(isAmsAdministrator(admin), true);
  assert.equal(isAmsAdministrator(officer), false);
  assert.equal(isAmsAdministrator(reviewer), false);
  assert.equal(isAmsAdministrator(ict), false);
  assert.equal(hasAdminPermission(admin, ADMIN_PERMISSIONS.MANAGE_USERS), true);
  assert.equal(hasAdminPermission(officer, ADMIN_PERMISSIONS.MANAGE_USERS), false);
});

test('infer access role from finance module/role', () => {
  assert.equal(inferAccessRole({ module: 'Admin', role: { name: 'Admin' } }), 'Administrator');
  assert.equal(inferAccessRole({ module: 'Finance', role: { name: 'Reviewer' } }), 'Reviewer');
  assert.equal(inferAccessRole({ module: 'Finance', role: { name: 'Officer' } }), 'Officer');
  assert.equal(inferAccessRole({ module: 'Finance', role: { name: 'ModuleUser' } }), 'Officer');
});

test('access role catalog and matrix exist', () => {
  assert.ok(accessRoleByKey('Officer'));
  assert.ok(accessRoleByKey('Reviewer'));
  assert.ok(accessRoleByKey('Administrator'));
  assert.ok(ACCESS_MATRIX.length >= 8);
  assert.ok(ACCESS_MATRIX.some((r) => r.function === 'User Management' && r.officer === 'No'));
});
