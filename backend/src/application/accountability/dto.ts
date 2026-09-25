import { sumAccounted, outstanding, variance } from '../../domain/accountability/finance.js';
import { isOverdue } from '../../domain/accountability/statuses.js';
import type { AccEventRow, AccountabilityRecord } from './ports.js';

export function toAccountabilityDto(row: AccountabilityRecord, now = new Date()) {
  const accounted = sumAccounted(row.lines);
  const returned = Number(row.amountReturned || 0);
  const advanced = Number(row.amountAdvanced || 0);
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    activityId: row.activityId,
    personId: row.personId ?? null,
    activity: {
      id: row.activityId,
      title: row.activityTitle,
      departmentName: row.activityDepartmentName,
      createdById: row.activityCreatedById,
      hasActivityReport: row.activityHasReport,
    },
    status: row.status,
    currency: row.currency,
    amountAdvanced: advanced,
    amountAccounted: accounted,
    amountReturned: returned,
    outstandingBalance: outstanding(advanced, accounted, returned),
    variance: variance(advanced, accounted, returned),
    dueDate: row.dueDate,
    overdue: isOverdue(row.dueDate, row.status, now),
    submittedById: row.submittedById,
    submittedAt: row.submittedAt,
    reviewerId: row.reviewerId,
    assignedAt: row.assignedAt,
    assignedById: row.assignedById,
    reviewedAt: row.reviewedAt,
    approvedAt: row.approvedAt,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
    closedAt: row.closedAt,
    closureReason: row.closureReason,
    returnReason: row.returnReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines,
    documents: row.documents,
    clarifications: row.clarifications,
    comments: row.comments,
    nextActor:
      row.status === 'draft' || row.status === 'returned' || row.status === 'clarification_requested'
        ? 'submitter'
        : row.status === 'submitted' || row.status === 'resubmitted' || row.status === 'under_review'
          ? 'reviewer'
          : row.status === 'approved'
            ? 'reviewer'
            : null,
  };
}

export function toAccEventDto(event: AccEventRow) {
  return {
    id: event.id,
    action: event.action,
    summary: event.summary,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    meta: event.meta,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt,
  };
}
