import type { ActivityAggregate, EventRow } from '../../domain/activity/types.js';
import { needsActivityReport } from '../../domain/activity/statuses.js';

export function latestReport(activity: ActivityAggregate) {
  const reports = activity.documents
    .filter((d) => d.kind === 'activity_report')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return reports[0] ?? null;
}

export function toActivityDto(activity: ActivityAggregate) {
  const report = latestReport(activity);
  const hasActivityReport = !!report;
  return {
    id: activity.id,
    financeActivityId: activity.financeActivityId,
    title: activity.title,
    activityName: activity.title,
    description: activity.description,
    requestedBy: activity.requestedBy,
    location: activity.location,
    departmentId: activity.departmentId,
    departmentName: activity.departmentName,
    dept: activity.departmentName,
    department: activity.departmentName ? { name: activity.departmentName } : null,
    activityDate: activity.activityDate,
    invoiceDate: activity.activityDate,
    endDate: activity.endDate,
    budgetAmount: activity.budgetAmount,
    amount: activity.budgetAmount,
    amt: activity.budgetAmount,
    funder: activity.funder,
    referenceNumber: activity.referenceNumber,
    voucherNumber: activity.referenceNumber,
    vocherno: activity.referenceNumber,
    activityType: activity.activityType,
    days: activity.days,
    status: activity.status,
    createdById: activity.createdById,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    participants: activity.participants.map((p) => ({
      id: p.id,
      personId: p.personId ?? null,
      name: p.name,
      title: p.title,
      phone: p.phone,
      amount: p.amount,
      days: p.days,
    })),
    documents: activity.documents,
    hasActivityReport,
    reportPath: report?.storedPath ?? null,
    needsActivityReport: needsActivityReport(activity.status, hasActivityReport),
  };
}

export function toEventDto(event: EventRow) {
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
