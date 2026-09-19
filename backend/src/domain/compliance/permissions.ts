import type { Actor } from '../activity/permissions.js';
import { PERMISSIONS, hasPermission } from '../activity/permissions.js';

export const COMPLIANCE_PERMISSIONS = {
  VIEW: 'compliance:view',
  PREVIEW: 'compliance:preview',
} as const;

export function canViewCompliance(actor: Actor): boolean {
  const moduleName = String(actor.module || '').toLowerCase();
  const roleName = String(actor.roleName || '').toLowerCase();
  const isAdmin =
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super');
  const isReviewer = roleName.includes('review') || roleName.includes('auditor');
  const isComplianceRole = roleName.includes('compliance');
  // Officers need to see participation/accountability issues from the AMS sidebar.
  const isFinanceOfficer =
    (moduleName === 'finance' || moduleName === '') &&
    !isReviewer &&
    !roleName.includes('ict');
  return isAdmin || isReviewer || isComplianceRole || isFinanceOfficer || hasPermission(actor, PERMISSIONS.CREATE);
}

/** Officers creating/editing activities may run a pre-submission compliance preview. */
export function canPreviewCompliance(actor: Actor): boolean {
  return canViewCompliance(actor) || hasPermission(actor, PERMISSIONS.CREATE) || hasPermission(actor, PERMISSIONS.EDIT);
}
