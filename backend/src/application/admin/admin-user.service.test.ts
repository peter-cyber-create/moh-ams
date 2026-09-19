import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdminUserService } from './admin-user.service.js';
import { DomainError } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';

const admin: Actor = { id: 'a1', email: 'a@x', name: 'Admin', module: 'Admin', roleName: 'Admin', isActive: true };
const officer: Actor = { id: 'o1', email: 'o@x', name: 'Off', module: 'Finance', roleName: 'Officer', isActive: true };

class FakeIdentity {
  users = new Map<string, Record<string, unknown>>([
    [
      'u1',
      {
        id: 'u1',
        name: 'Jane Officer',
        email: 'jane@example.com',
        module: 'Finance',
        isActive: true,
        role: { id: 'role-officer', name: 'Officer' },
        department: { id: 'd1', name: 'Accounts' },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    [
      'a1',
      {
        id: 'a1',
        name: 'Admin',
        email: 'a@x',
        module: 'Admin',
        isActive: true,
        role: { id: 'role-admin', name: 'Admin' },
        department: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  ]);
  roles = [
    { id: 'role-officer', name: 'Officer' },
    { id: 'role-reviewer', name: 'Reviewer' },
    { id: 'role-admin', name: 'Admin' },
  ];

  async upsertIdentity() {
    return null;
  }

  async financeFetch(_token: string, path: string, init: RequestInit = {}) {
    if (path.startsWith('/api/admin/roles') && (!init.method || init.method === 'GET')) {
      return { ok: true, status: 200, body: this.roles };
    }
    if (path === '/api/admin/roles' && init.method === 'POST') {
      const body = JSON.parse(String(init.body || '{}'));
      const row = { id: `role-${body.name}`, name: body.name };
      this.roles.push(row);
      return { ok: true, status: 201, body: row };
    }
    if (path.startsWith('/api/admin/users?') || path === '/api/admin/users') {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body || '{}'));
        if ([...this.users.values()].some((u) => u.email === body.email)) {
          return { ok: false, status: 400, body: { error: 'Email already exists' } };
        }
        const id = `u${this.users.size + 1}`;
        const role = this.roles.find((r) => r.id === body.roleId) || this.roles[0];
        const row = {
          id,
          name: body.name,
          email: body.email,
          phone: body.phone || null,
          module: body.module,
          isActive: body.isActive !== false,
          role,
          department: null,
          createdAt: new Date().toISOString(),
        };
        this.users.set(id, row);
        return { ok: true, status: 201, body: row };
      }
      return {
        ok: true,
        status: 200,
        body: { data: [...this.users.values()], total: this.users.size, page: 1, limit: 50 },
      };
    }
    if (path.startsWith('/api/admin/users/')) {
      const id = path.split('/').pop()!;
      if (init.method === 'PATCH') {
        const current = this.users.get(id);
        if (!current) return { ok: false, status: 404, body: { error: 'User not found' } };
        const body = JSON.parse(String(init.body || '{}'));
        if (body.roleId) current.role = this.roles.find((r) => r.id === body.roleId) || current.role;
        if (body.module !== undefined) current.module = body.module;
        if (body.isActive !== undefined) current.isActive = body.isActive;
        if (body.name !== undefined) current.name = body.name;
        if (body.password !== undefined) current._passwordSet = true;
        this.users.set(id, current);
        return { ok: true, status: 200, body: current };
      }
      const current = this.users.get(id);
      if (!current) return { ok: false, status: 404, body: { error: 'User not found' } };
      return { ok: true, status: 200, body: current };
    }
    if (path === '/api/admin/departments') return { ok: true, status: 200, body: [{ id: 'd1', name: 'Accounts' }] };
    return { ok: false, status: 404, body: { error: 'not found' } };
  }
}

test('officer cannot list users', async () => {
  const service = new AdminUserService(new FakeIdentity() as never);
  await assert.rejects(() => service.list(officer, 't', {}), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('admin can create user and duplicate email is rejected', async () => {
  const fake = new FakeIdentity();
  const service = new AdminUserService(fake as never);
  const created = await service.create(admin, 't', {
    name: 'New Officer',
    email: 'new@example.com',
    accessRole: 'Officer',
    password: 'Password1',
    confirmPassword: 'Password1',
  });
  assert.equal(created.accessRole, 'Officer');
  assert.equal(created.status, 'Active');
  await assert.rejects(
    () =>
      service.create(admin, 't', {
        name: 'Dup',
        email: 'new@example.com',
        accessRole: 'Officer',
        password: 'Password1',
        confirmPassword: 'Password1',
      }),
    /already in use|already exists/i,
  );
});

test('admin can deactivate and reactivate; last admin protected', async () => {
  const fake = new FakeIdentity();
  const service = new AdminUserService(fake as never);
  const deactivated = await service.deactivate(admin, 't', 'u1');
  assert.equal(deactivated.status, 'Inactive');
  const reactivated = await service.reactivate(admin, 't', 'u1');
  assert.equal(reactivated.status, 'Active');
  await assert.rejects(() => service.deactivate(admin, 't', 'a1'), /only active Administrator/i);
});

test('role change requires confirmation', async () => {
  const fake = new FakeIdentity();
  const service = new AdminUserService(fake as never);
  await assert.rejects(() => service.update(admin, 't', 'u1', { accessRole: 'Reviewer' }), /Confirm role change/i);
  const updated = await service.update(admin, 't', 'u1', { accessRole: 'Reviewer', confirmRoleChange: true });
  assert.equal(updated.accessRole, 'Reviewer');
});

test('password reset validates confirmation', async () => {
  const fake = new FakeIdentity();
  const service = new AdminUserService(fake as never);
  await assert.rejects(() => service.resetPassword(admin, 't', 'u1', { password: 'short', confirmPassword: 'short' }), /8 characters/i);
  const ok = await service.resetPassword(admin, 't', 'u1', { password: 'Password1', confirmPassword: 'Password1' });
  assert.equal(ok.ok, true);
});
