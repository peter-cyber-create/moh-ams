import type { Actor } from '../activity/permissions.js';

export const ACC_PERMISSIONS = {
  CREATE: 'accountability:create',
  VIEW: 'accountability:view',
  VIEW_ALL: 'accountability:view_all',
  SUBMIT: 'accountability:submit',
  REVIEW: 'accountability:review',
  RETURN: 'accountability:return',
  CLARIFY: 'accountability:clarify',
  APPROVE: 'accountability:approve',
  REJECT: 'accountability:reject',
  CLOSE: 'accountability:close',
  ASSIGN: 'accountability:assign',
  MANAGE: 'accountability:manage',
} as const;

export type AccPermission = (typeof ACC_PERMISSIONS)[keyof typeof ACC_PERMISSIONS];

export function accountabilityPermissionsFor(actor: Actor): Set<string> {
  const moduleName = String(actor.module || '').toLowerCase();
  const roleName = String(actor.roleName || '').toLowerCase();
  const isAdmin =
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super');
  const isReviewerRole = roleName.includes('review') || roleName.includes('auditor');
  const isOfficer = isAdmin || ((moduleName === 'finance' || moduleName === '') && !isReviewerRole);
  const isReviewer = isAdmin || isReviewerRole;

  const perms = new Set<string>();
  if (!isOfficer && !isReviewer) return perms;
  perms.add(ACC_PERMISSIONS.VIEW);
  if (isOfficer) {
    perms.add(ACC_PERMISSIONS.CREATE);
    perms.add(ACC_PERMISSIONS.SUBMIT);
  }
  if (isReviewer) {
    perms.add(ACC_PERMISSIONS.VIEW_ALL);
    perms.add(ACC_PERMISSIONS.REVIEW);
    perms.add(ACC_PERMISSIONS.RETURN);
    perms.add(ACC_PERMISSIONS.CLARIFY);
    perms.add(ACC_PERMISSIONS.APPROVE);
    perms.add(ACC_PERMISSIONS.REJECT);
    perms.add(ACC_PERMISSIONS.CLOSE);
    perms.add(ACC_PERMISSIONS.ASSIGN);
  }
  if (isAdmin) {
    perms.add(ACC_PERMISSIONS.MANAGE);
    Object.values(ACC_PERMISSIONS).forEach((p) => perms.add(p));
  }
  return perms;
}

export function hasAccPermission(actor: Actor, permission: AccPermission): boolean {
  const perms = accountabilityPermissionsFor(actor);
  return perms.has(ACC_PERMISSIONS.MANAGE) || perms.has(permission);
}

export function isReviewerActor(actor: Actor): boolean {
  return hasAccPermission(actor, ACC_PERMISSIONS.REVIEW);
}

export function canAccessCase(
  actor: Actor,
  caseRow: { submittedById: string; reviewerId: string | null; activityCreatedById?: string },
): boolean {
  if (hasAccPermission(actor, ACC_PERMISSIONS.VIEW_ALL) || hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) return true;
  if (actor.id === caseRow.submittedById) return true;
  if (caseRow.activityCreatedById && actor.id === caseRow.activityCreatedById) return true;
  if (caseRow.reviewerId && actor.id === caseRow.reviewerId) return true;
  return false;
}

export function canDecideAsReviewer(actor: Actor, reviewerId: string | null): boolean {
  if (hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) return true;
  if (!hasAccPermission(actor, ACC_PERMISSIONS.REVIEW)) return false;
  return reviewerId === actor.id;
}
