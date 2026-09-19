export type Actor = {
  id: string;
  email: string;
  name: string;
  module: string | null;
  roleName: string | null;
  isActive: boolean;
};

export const PERMISSIONS = {
  CREATE: 'activity:create',
  VIEW: 'activity:view',
  EDIT: 'activity:edit',
  SUBMIT: 'activity:submit',
  REPORT: 'activity:report',
  CLOSE: 'activity:close',
  CANCEL: 'activity:cancel',
  VIEW_ALL: 'activity:view_all',
  MANAGE: 'activity:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function permissionsFor(actor: Actor): Set<string> {
  const moduleName = String(actor.module || '').toLowerCase();
  const roleName = String(actor.roleName || '').toLowerCase();
  const isAdmin =
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super');
  const isReviewerRole = roleName.includes('review') || roleName.includes('auditor');
  const isReviewer = isAdmin || isReviewerRole;
  const isOfficer =
    isAdmin || ((moduleName === 'finance' || moduleName === '') && !isReviewerRole);

  const perms = new Set<string>();
  if (!isOfficer && !isReviewer) return perms;

  perms.add(PERMISSIONS.VIEW);
  if (isOfficer) {
    perms.add(PERMISSIONS.CREATE);
    perms.add(PERMISSIONS.EDIT);
    perms.add(PERMISSIONS.SUBMIT);
    perms.add(PERMISSIONS.REPORT);
    perms.add(PERMISSIONS.CANCEL);
  }
  if (isReviewer) {
    perms.add(PERMISSIONS.VIEW_ALL);
    perms.add(PERMISSIONS.CLOSE);
  }
  if (isAdmin) {
    perms.add(PERMISSIONS.MANAGE);
    Object.values(PERMISSIONS).forEach((p) => perms.add(p));
  }
  return perms;
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  const perms = permissionsFor(actor);
  return perms.has(PERMISSIONS.MANAGE) || perms.has(permission);
}

export function canAccessActivity(actor: Actor, createdById: string): boolean {
  if (hasPermission(actor, PERMISSIONS.VIEW_ALL) || hasPermission(actor, PERMISSIONS.MANAGE)) return true;
  return actor.id === createdById;
}
