// Always refresh from Finance so role/deactivation apply on the next request.
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { config } from '../config.js';
import type { Actor } from '../domain/activity/permissions.js';
import { unauthorized } from '../domain/activity/errors.js';

type FinanceProfile = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  module?: string | null;
  isActive?: boolean;
  role?: { name?: string | null } | string | null;
  department?: { id?: string; name?: string | null } | null;
  departmentId?: string | null;
  phone?: string | null;
  createdAt?: string | null;
};

function roleLabel(profile: FinanceProfile) {
  if (typeof profile.role === 'string') return profile.role;
  return profile.role?.name ?? null;
}

function moduleName(profile: FinanceProfile) {
  if (profile.module) return profile.module;
  const role = String(roleLabel(profile) || '').toLowerCase();
  if (role.includes('admin') || role.includes('super')) return 'all';
  return null;
}

export class FinanceIdentityDirectory {
  async resolveFromToken(token: string): Promise<Actor> {
    try {
      jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('Invalid or expired token');
    }
    const profile = await this.fetchFinanceProfile(token);
    const saved = await this.upsertIdentity(profile);
    if (!saved.isActive) {
      throw unauthorized('Your account is inactive. Contact an administrator.');
    }
    return {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      module: saved.module,
      roleName: saved.roleName,
      isActive: saved.isActive,
    };
  }

  async upsertIdentity(profile: FinanceProfile) {
    return prisma.identityUser.upsert({
      where: { id: profile.id },
      update: {
        email: profile.email,
        name: profile.name,
        username: profile.username ?? null,
        module: moduleName(profile),
        roleName: roleLabel(profile),
        departmentId: profile.department?.id ?? profile.departmentId ?? null,
        departmentName: profile.department?.name ?? null,
        isActive: profile.isActive !== false,
      },
      create: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        username: profile.username ?? null,
        module: moduleName(profile),
        roleName: roleLabel(profile),
        departmentId: profile.department?.id ?? profile.departmentId ?? null,
        departmentName: profile.department?.name ?? null,
        isActive: profile.isActive !== false,
      },
    });
  }

  async fetchFinanceProfile(token: string): Promise<FinanceProfile> {
    const res = await fetch(`${config.financeApiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw unauthorized('Invalid or expired token');
    return (await res.json()) as FinanceProfile;
  }

  /** Forward admin calls to Finance with the caller's token (Admin module required by Finance). */
  async financeFetch(token: string, path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetch(`${config.financeApiUrl}${path}`, { ...init, headers });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text || 'Unexpected response from identity service.' };
    }
    return { ok: res.ok, status: res.status, body };
  }
}
