import type { Actor } from '../activity/permissions.js';

export const PERSON_PERMISSIONS = {
  VIEW: 'person:view',
  SEARCH: 'person:search',
  CREATE: 'person:create',
  EDIT: 'person:edit',
  LINK: 'person:link',
  MERGE: 'person:merge',
} as const;

function flags(actor: Actor) {
  const moduleName = String(actor.module || '').toLowerCase();
  const roleName = String(actor.roleName || '').toLowerCase();
  const isAdmin =
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super');
  const isReviewer = isAdmin || roleName.includes('review') || roleName.includes('auditor');
  const isOfficer = isAdmin || ((moduleName === 'finance' || moduleName === '') && !roleName.includes('review') && !roleName.includes('auditor'));
  return { isAdmin, isReviewer, isOfficer };
}

export function hasPersonPermission(actor: Actor, permission: string): boolean {
  const { isAdmin, isReviewer, isOfficer } = flags(actor);
  if (isAdmin) return true;
  if (permission === PERSON_PERMISSIONS.VIEW || permission === PERSON_PERMISSIONS.SEARCH) {
    return isOfficer || isReviewer;
  }
  if (permission === PERSON_PERMISSIONS.LINK) return isReviewer;
  if (permission === PERSON_PERMISSIONS.CREATE || permission === PERSON_PERMISSIONS.EDIT) return false;
  return false;
}
