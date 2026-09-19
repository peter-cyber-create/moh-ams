export const ACTIVITY_STATUSES = ['draft', 'planned', 'ongoing', 'report_submitted', 'closed', 'cancelled'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const OFFICIAL_STATUSES = ['planned', 'ongoing', 'report_submitted', 'closed', 'cancelled'] as const;

export const ALLOWED_STATUS_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  draft: ['planned'],
  planned: ['ongoing', 'cancelled'],
  ongoing: ['report_submitted', 'cancelled'],
  report_submitted: ['closed', 'ongoing'],
  closed: [],
  cancelled: [],
};

export function isActivityStatus(value: string): value is ActivityStatus {
  return (ACTIVITY_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: string | null | undefined, to: string): boolean {
  const current = String(from || 'planned').trim().toLowerCase();
  const next = String(to || '').trim().toLowerCase();
  if (!isActivityStatus(next)) return false;
  if (!isActivityStatus(current)) return false;
  if (current === next) return true;
  return ALLOWED_STATUS_TRANSITIONS[current].includes(next);
}

export function isOfficialStatus(status: string): boolean {
  return (OFFICIAL_STATUSES as readonly string[]).includes(status);
}

export function isEditableStatus(status: string): boolean {
  return status === 'draft' || status === 'planned' || status === 'ongoing';
}

export function canReceiveReport(status: string): boolean {
  return status !== 'closed' && status !== 'cancelled' && status !== 'draft';
}

export function isTerminal(status: string): boolean {
  return status === 'closed' || status === 'cancelled';
}

/** Activity still needs a report file. Drafts are unpublished and are not due. */
export function needsActivityReport(status: string, hasActivityReport: boolean): boolean {
  if (status === 'draft' || isTerminal(status)) return false;
  return !hasActivityReport;
}
