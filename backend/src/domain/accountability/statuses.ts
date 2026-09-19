export const ACCOUNTABILITY_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'clarification_requested',
  'returned',
  'resubmitted',
  'approved',
  'rejected',
  'closed',
] as const;

export type AccountabilityStatus = (typeof ACCOUNTABILITY_STATUSES)[number];

export const TERMINAL_STATUSES = ['rejected', 'closed'] as const;
export const SETTLED_STATUSES = ['approved', 'rejected', 'closed'] as const;

export const ALLOWED_ACCOUNTABILITY_TRANSITIONS: Record<AccountabilityStatus, AccountabilityStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['clarification_requested', 'returned', 'approved', 'rejected'],
  clarification_requested: ['under_review'],
  returned: ['resubmitted'],
  resubmitted: ['under_review'],
  approved: ['closed'],
  rejected: [],
  closed: [],
};

export const ACCOUNTABILITY_DUE_DAYS = 60;

export function isAccountabilityStatus(value: string): value is AccountabilityStatus {
  return (ACCOUNTABILITY_STATUSES as readonly string[]).includes(value);
}

export function canTransitionAccountability(from: string, to: string): boolean {
  if (!isAccountabilityStatus(from) || !isAccountabilityStatus(to)) return false;
  if (from === to) return true;
  return ALLOWED_ACCOUNTABILITY_TRANSITIONS[from].includes(to);
}

export function isOpenStatus(status: string): boolean {
  return !TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number]);
}

export function isEditableStatus(status: string): boolean {
  return status === 'draft' || status === 'returned' || status === 'clarification_requested';
}

export function isReviewQueueStatus(status: string): boolean {
  return status === 'submitted' || status === 'under_review' || status === 'resubmitted';
}

export function defaultDueDate(from = new Date(), days = ACCOUNTABILITY_DUE_DAYS): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function isOverdue(dueDate: Date, status: string, now = new Date()): boolean {
  if (SETTLED_STATUSES.includes(status as (typeof SETTLED_STATUSES)[number])) return false;
  return dueDate.getTime() < now.getTime();
}

export function formatReference(year: number, seq: number): string {
  return `ACC-${year}-${String(seq).padStart(6, '0')}`;
}
