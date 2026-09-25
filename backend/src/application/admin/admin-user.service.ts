import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma.js';
import { badRequest, forbidden, notFound } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';
import {
  ACCESS_MATRIX,
  AMS_ACCESS_ROLES,
  accessRoleByKey,
  hasAdminPermission,
  ADMIN_PERMISSIONS,
  inferAccessRole,
  type AmsAccessRoleKey,
} from '../../domain/admin/access.js';
import type { FinanceIdentityDirectory } from '../../infrastructure/finance-identity.js';

type FinanceUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  module?: string | null;
  isActive?: boolean;
  createdAt?: string;
  role?: { id?: string; name?: string } | null;
  department?: { id?: string; name?: string; code?: string } | null;
  departmentId?: string | null;
  roleId?: string | null;
};

function financeError(body: unknown, fallback: string) {
  const err = (body as { error?: string })?.error;
  if (!err) return fallback;
  if (/already exists|already in use/i.test(err)) {
    return 'That account could not be created because the email is already in use.';
  }
  if (/not found/i.test(err)) return 'User was not found.';
  return err;
}

function mapUser(u: FinanceUser, person?: { id: string; personReference: string; fullName: string } | null) {
  const accessRole = inferAccessRole(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username || null,
    phone: u.phone || null,
    module: u.module || null,
    roleName: u.role?.name || null,
    accessRole,
    departmentId: u.department?.id || u.departmentId || null,
    departmentName: u.department?.name || null,
    status: u.isActive === false ? 'Inactive' : 'Active',
    isActive: u.isActive !== false,
    createdAt: u.createdAt || null,
    person: person
      ? { id: person.id, personReference: person.personReference, name: person.fullName }
      : null,
  };
}

export class AdminUserService {
  constructor(private readonly identity: FinanceIdentityDirectory) {}

  private requireAdmin(actor: Actor) {
    if (!hasAdminPermission(actor, ADMIN_PERMISSIONS.MANAGE_USERS)) {
      throw forbidden('You do not have permission to perform this action.');
    }
  }

  private async audit(actor: Actor, action: string, targetUserId: string | null, summary: string, meta: Record<string, unknown> = {}) {
    try {
      await prisma.adminAuditEvent.create({
        data: {
          actorUserId: actor.id,
          action,
          targetUserId,
          summary,
          meta: meta as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit must not break admin operations.
    }
  }

  private async personFor(userId: string) {
    try {
      return await prisma.person.findFirst({
        where: { identityUserId: userId },
        select: { id: true, personReference: true, fullName: true },
      });
    } catch {
      return null;
    }
  }

  private async personsFor(ids: string[]) {
    if (!ids.length) return new Map();
    try {
      const rows = await prisma.person.findMany({
        where: { identityUserId: { in: ids } },
        select: { id: true, personReference: true, fullName: true, identityUserId: true },
      });
      return new Map(rows.filter((r) => r.identityUserId).map((r) => [r.identityUserId!, r]));
    } catch {
      return new Map();
    }
  }

  async listRoles(actor: Actor) {
    this.requireAdmin(actor);
    return {
      data: AMS_ACCESS_ROLES.map((r) => ({
        key: r.key,
        label: r.label,
        description: r.description,
        longDescription: r.longDescription,
      })),
    };
  }

  accessMatrix(actor: Actor) {
    this.requireAdmin(actor);
    return { data: ACCESS_MATRIX, roles: AMS_ACCESS_ROLES.map((r) => ({ key: r.key, label: r.label, description: r.description })) };
  }

  async listDepartments(actor: Actor, token: string) {
    this.requireAdmin(actor);
    const res = await this.identity.financeFetch(token, '/api/admin/departments');
    if (!res.ok) throw forbidden(financeError(res.body, 'Could not load departments.'));
    const body = res.body as { data?: unknown } | unknown[];
    const data = Array.isArray(body) ? body : (body as { data?: unknown[] }).data || body;
    return { data };
  }

  private async ensureFinanceRole(token: string, roleName: string): Promise<string> {
    const listed = await this.identity.financeFetch(token, '/api/admin/roles');
    if (!listed.ok) throw badRequest(financeError(listed.body, 'Could not load roles.'));
    const roles = (Array.isArray(listed.body) ? listed.body : (listed.body as { data?: unknown[] })?.data || []) as Array<{
      id: string;
      name: string;
    }>;
    const existing = roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
    if (existing) return existing.id;
    const created = await this.identity.financeFetch(token, '/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify({ name: roleName }),
    });
    if (!created.ok) throw badRequest(financeError(created.body, 'Could not ensure role.'));
    const row = created.body as { id?: string };
    if (!row.id) throw badRequest('Could not ensure role.');
    return row.id;
  }

  private async countActiveAdministrators(token: string) {
    const res = await this.identity.financeFetch(token, '/api/admin/users?limit=100&page=1');
    if (!res.ok) return 0;
    const body = res.body as { data?: FinanceUser[] };
    const users = body.data || [];
    return users.filter((u) => u.isActive !== false && inferAccessRole(u) === 'Administrator').length;
  }

  async list(actor: Actor, token: string, query: { search?: string; page?: number; limit?: number; status?: string; role?: string; departmentId?: string }) {
    this.requireAdmin(actor);
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.departmentId) params.set('departmentId', query.departmentId);
    params.set('page', String(query.page || 1));
    params.set('limit', String(Math.min(100, query.limit || 50)));
    const res = await this.identity.financeFetch(token, `/api/admin/users?${params}`);
    if (!res.ok) throw forbidden(financeError(res.body, 'Could not load users.'));
    const body = res.body as { data: FinanceUser[]; total: number; page: number; limit: number };
    let data = body.data || [];
    if (query.status === 'Active') data = data.filter((u) => u.isActive !== false);
    if (query.status === 'Inactive') data = data.filter((u) => u.isActive === false);
    if (query.role) data = data.filter((u) => inferAccessRole(u) === query.role);
    const people = await this.personsFor(data.map((u) => u.id));
    return {
      data: data.map((u) => mapUser(u, people.get(u.id) || null)),
      total: query.status || query.role ? data.length : body.total,
      page: body.page,
      limit: body.limit,
    };
  }

  async getById(actor: Actor, token: string, id: string) {
    this.requireAdmin(actor);
    const res = await this.identity.financeFetch(token, `/api/admin/users/${id}`);
    if (res.status === 404) throw notFound('User was not found.');
    if (!res.ok) throw forbidden(financeError(res.body, 'Could not load user.'));
    const u = res.body as FinanceUser;
    const person = await this.personFor(id);
    await this.identity.upsertIdentity({
      id: u.id,
      email: u.email,
      name: u.name,
      username: u.username,
      module: u.module,
      isActive: u.isActive,
      role: u.role,
      department: u.department,
      departmentId: u.departmentId,
    });
    return mapUser(u, person);
  }

  async create(
    actor: Actor,
    token: string,
    body: {
      name?: string;
      email?: string;
      phone?: string;
      departmentId?: string;
      accessRole?: string;
      password?: string;
      confirmPassword?: string;
      status?: string;
    },
  ) {
    this.requireAdmin(actor);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const confirm = String(body.confirmPassword || '');
    if (!name) throw badRequest('Full name is required.');
    if (!email || !email.includes('@')) throw badRequest('A valid email is required.');
    if (password.length < 8) throw badRequest('Password must be at least 8 characters.');
    if (password !== confirm) throw badRequest('Password and confirmation do not match.');
    const roleDef = accessRoleByKey(String(body.accessRole || 'Officer'));
    if (!roleDef) throw badRequest('Select a valid role.');
    const roleId = await this.ensureFinanceRole(token, roleDef.financeRoleName);
    const res = await this.identity.financeFetch(token, '/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        phone: body.phone || undefined,
        departmentId: body.departmentId || undefined,
        module: roleDef.financeModule,
        roleId,
        isActive: String(body.status || 'Active').toLowerCase() !== 'inactive',
      }),
    });
    if (!res.ok) throw badRequest(financeError(res.body, 'Could not create the account.'));
    const u = res.body as FinanceUser;
    await this.identity.upsertIdentity({
      id: u.id,
      email: u.email,
      name: u.name,
      username: u.username,
      module: u.module,
      isActive: u.isActive,
      role: u.role,
      department: u.department,
      departmentId: u.departmentId,
    });
    await this.audit(actor, 'USER_CREATED', u.id, `Created account ${u.email}`, {
      accessRole: roleDef.key,
    });
    return mapUser(u, null);
  }

  async update(
    actor: Actor,
    token: string,
    id: string,
    body: {
      name?: string;
      phone?: string | null;
      departmentId?: string | null;
      accessRole?: string;
      status?: string;
      confirmRoleChange?: boolean;
    },
  ) {
    this.requireAdmin(actor);
    const current = await this.getById(actor, token, id);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name || '').trim();
    if (body.phone !== undefined) patch.phone = body.phone;
    if (body.departmentId !== undefined) patch.departmentId = body.departmentId;

    let nextRole: AmsAccessRoleKey | null = null;
    if (body.accessRole && body.accessRole !== current.accessRole) {
      if (!body.confirmRoleChange) {
        throw badRequest(`Confirm role change from ${current.accessRole} to ${body.accessRole}.`);
      }
      const roleDef = accessRoleByKey(body.accessRole);
      if (!roleDef) throw badRequest('Select a valid role.');
      if (current.accessRole === 'Administrator' && roleDef.key !== 'Administrator') {
        const admins = await this.countActiveAdministrators(token);
        if (admins <= 1 && current.isActive) {
          throw badRequest('This is the only active Administrator account and cannot have its role removed.');
        }
      }
      patch.module = roleDef.financeModule;
      patch.roleId = await this.ensureFinanceRole(token, roleDef.financeRoleName);
      nextRole = roleDef.key;
    }

    if (body.status) {
      const active = String(body.status).toLowerCase() !== 'inactive';
      if (!active && current.isActive && current.accessRole === 'Administrator') {
        const admins = await this.countActiveAdministrators(token);
        if (admins <= 1) {
          throw badRequest('This is the only active Administrator account and cannot be deactivated.');
        }
      }
      patch.isActive = active;
    }

    const res = await this.identity.financeFetch(token, `/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw badRequest(financeError(res.body, 'Could not save changes.'));
    const u = res.body as FinanceUser;
    await this.identity.upsertIdentity({
      id: u.id,
      email: u.email,
      name: u.name,
      username: u.username,
      module: u.module,
      isActive: u.isActive,
      role: u.role,
      department: u.department,
      departmentId: u.departmentId,
    });
    if (nextRole) {
      await this.audit(actor, 'ROLE_CHANGED', id, `Changed role to ${nextRole}`, {
        from: current.accessRole,
        to: nextRole,
      });
    } else if (body.status && String(body.status).toLowerCase() === 'inactive' && current.isActive) {
      await this.audit(actor, 'USER_DEACTIVATED', id, `Deactivated ${u.email}`, {});
    } else if (body.status && String(body.status).toLowerCase() !== 'inactive' && !current.isActive) {
      await this.audit(actor, 'USER_REACTIVATED', id, `Reactivated ${u.email}`, {});
    } else {
      await this.audit(actor, 'USER_UPDATED', id, `Updated account ${u.email}`, {});
    }
    const person = await this.personFor(id);
    return mapUser(u, person);
  }

  async deactivate(actor: Actor, token: string, id: string) {
    return this.update(actor, token, id, { status: 'Inactive' });
  }

  async reactivate(actor: Actor, token: string, id: string) {
    return this.update(actor, token, id, { status: 'Active' });
  }

  async resetPassword(actor: Actor, token: string, id: string, body: { password?: string; confirmPassword?: string }) {
    this.requireAdmin(actor);
    const password = String(body.password || '');
    const confirm = String(body.confirmPassword || '');
    if (password.length < 8) throw badRequest('Password must be at least 8 characters.');
    if (password !== confirm) throw badRequest('Password and confirmation do not match.');
    const res = await this.identity.financeFetch(token, `/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw badRequest(financeError(res.body, 'Could not reset password.'));
    await this.audit(actor, 'PASSWORD_RESET', id, 'Administrator reset password', {});
    return { ok: true };
  }
}
