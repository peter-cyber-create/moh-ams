export const PENDING_ACCOUNTABILITY_STATUSES = [
  'submitted',
  'under_review',
  'returned',
  'clarification_requested',
  'resubmitted',
] as const;

export const CLEARED_ACCOUNTABILITY_STATUSES = ['approved', 'closed'] as const;
export const REJECTED_ACCOUNTABILITY_STATUSES = ['rejected'] as const;

export function isPendingAccountability(status: string): boolean {
  return (PENDING_ACCOUNTABILITY_STATUSES as readonly string[]).includes(status);
}

export function isClearedAccountability(status: string): boolean {
  return (CLEARED_ACCOUNTABILITY_STATUSES as readonly string[]).includes(status);
}

export function isRejectedAccountability(status: string): boolean {
  return (REJECTED_ACCOUNTABILITY_STATUSES as readonly string[]).includes(status);
}

export function isOverdueAccountability(status: string, dueDate: Date, now = new Date()): boolean {
  if (!isPendingAccountability(status)) return false;
  return dueDate.getTime() < now.getTime();
}

export function daysOutstanding(dueDate: Date, now = new Date()): number {
  return Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
}
