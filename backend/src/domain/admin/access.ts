import type { Actor } from '../activity/permissions.js';

/** AMS administration permission. */
export const ADMIN_PERMISSIONS = {
  MANAGE_USERS: 'admin:users',
  VIEW_ACCESS: 'admin:access',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export function isAmsAdministrator(actor: Actor): boolean {
  const moduleName = String(actor.module || '').toLowerCase();
  const roleName = String(actor.roleName || '').toLowerCase();
  return (
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super')
  );
}

export function hasAdminPermission(actor: Actor, _permission: AdminPermission): boolean {
  return isAmsAdministrator(actor);
}

/** Business roles presented in AMS Administration. */
export const AMS_ACCESS_ROLES = [
  {
    key: 'Officer',
    label: 'Officer',
    description: 'Can manage your own operational work.',
    longDescription: 'Create/manage own Activities and perform permitted operational work.',
    financeModule: 'Finance',
    financeRoleName: 'Officer',
  },
  {
    key: 'Reviewer',
    label: 'Reviewer',
    description: 'Can review assigned or permitted cases.',
    longDescription: 'Review Activities/Accountabilities and perform permitted review and compliance functions.',
    financeModule: 'Finance',
    financeRoleName: 'Reviewer',
  },
  {
    key: 'Administrator',
    label: 'Administrator',
    description: 'Can manage users and system administration.',
    longDescription: 'Manage the AMS and users and perform authorized administrative functions.',
    financeModule: 'Admin',
    financeRoleName: 'Admin',
  },
] as const;

export type AmsAccessRoleKey = (typeof AMS_ACCESS_ROLES)[number]['key'];

export function accessRoleByKey(key: string) {
  return AMS_ACCESS_ROLES.find((r) => r.key.toLowerCase() === String(key || '').toLowerCase()) || null;
}

/** Map a Finance user snapshot to an AMS access role key. */
export function inferAccessRole(user: { module?: string | null; role?: { name?: string | null } | null; roleName?: string | null }) {
  const moduleName = String(user.module || '').toLowerCase();
  const roleName = String(user.role?.name || user.roleName || '').toLowerCase();
  if (
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super')
  ) {
    return 'Administrator';
  }
  if (roleName.includes('review') || roleName.includes('auditor')) return 'Reviewer';
  if (moduleName === 'finance' || moduleName === '' || roleName.includes('officer') || roleName.includes('module')) {
    return 'Officer';
  }
  return 'Officer';
}

export const ACCESS_MATRIX = [
  { function: 'Own Activities', officer: 'Yes', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Create Activity', officer: 'Yes', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Multiple Activities', officer: 'Yes', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Participant Upload', officer: 'Yes', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Own Accountability', officer: 'Yes', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Review Accountability', officer: 'No', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Compliance', officer: 'Limited', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'Reports', officer: 'Yes', reviewer: 'Yes', administrator: 'Yes' },
  { function: 'User Management', officer: 'No', reviewer: 'No', administrator: 'Yes' },
  { function: 'Administration', officer: 'No', reviewer: 'No', administrator: 'Yes' },
  { function: 'System', officer: 'No', reviewer: 'No', administrator: 'Yes' },
] as const;
