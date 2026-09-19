import { randomUUID } from 'node:crypto';
import { outstanding, variance } from '../domain/accountability/finance.js';
import { PENDING_ACCOUNTABILITY_STATUSES } from '../domain/compliance/accountability.js';
import { formatReference, isOpenStatus, isOverdue, isReviewQueueStatus, SETTLED_STATUSES } from '../domain/accountability/statuses.js';
import { ACC_PERMISSIONS, hasAccPermission } from '../domain/accountability/permissions.js';
import type { Actor } from '../domain/activity/permissions.js';
import type { ActivityAggregate } from '../domain/activity/types.js';
import type {
  AccClarificationRow,
  AccCommentRow,
  AccDocumentRow,
  AccEventRow,
  AccLineRow,
  AccListFilters,
  AccountabilityRecord,
  AccountabilityRepository,
  IdentityLookup,
} from '../application/accountability/ports.js';
import type { MemoryActivityRepository } from './memory-activity.repository.js';

export class MemoryAccountabilityRepository implements AccountabilityRepository {
  cases = new Map<string, AccountabilityRecord>();
  events: AccEventRow[] = [];
  seq = new Map<number, number>();

  constructor(private readonly activities: MemoryActivityRepository) {}

  private hydrateFromActivity(row: AccountabilityRecord, activity: ActivityAggregate | null): AccountabilityRecord {
    return {
      ...row,
      activityTitle: activity?.title || row.activityTitle,
      activityDepartmentName: activity?.departmentName ?? row.activityDepartmentName,
      activityCreatedById: activity?.createdById || row.activityCreatedById,
      activityHasReport: activity?.documents.some((d) => d.kind === 'activity_report') ?? row.activityHasReport,
      lines: row.lines.map((l) => ({ ...l })),
      documents: row.documents.map((d) => ({ ...d })),
      clarifications: row.clarifications.map((c) => ({ ...c })),
      comments: row.comments.map((c) => ({ ...c })),
    };
  }

  private snapshot(row: AccountabilityRecord): AccountabilityRecord {
    const activity = this.activities.activities.get(row.activityId) || null;
    return this.hydrateFromActivity(row, activity);
  }

  async nextReference(year: number) {
    const last = (this.seq.get(year) || 0) + 1;
    this.seq.set(year, last);
    return formatReference(year, last);
  }

  async list(filters: AccListFilters) {
    let rows = [...this.cases.values()].map((r) => this.snapshot(r));
    const actor = filters.actor;
    if (actor && !hasAccPermission(actor, ACC_PERMISSIONS.VIEW_ALL) && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) {
      rows = rows.filter(
        (r) => r.submittedById === actor.id || r.reviewerId === actor.id || r.activityCreatedById === actor.id,
      );
    }
    if (filters.activityId) rows = rows.filter((r) => r.activityId === filters.activityId);
    if (filters.reviewerId) rows = rows.filter((r) => r.reviewerId === filters.reviewerId);
    if (filters.submittedById) rows = rows.filter((r) => r.submittedById === filters.submittedById);
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.referenceNumber.toLowerCase().includes(q) ||
          r.activityTitle.toLowerCase().includes(q) ||
          String(r.activityDepartmentName || '').toLowerCase().includes(q),
      );
    }
    if (filters.department) {
      const q = filters.department.toLowerCase();
      rows = rows.filter((r) => String(r.activityDepartmentName || '').toLowerCase().includes(q));
    }
    const view = filters.view;
    if (view === 'mine' && actor) {
      rows = rows.filter((r) => r.submittedById === actor.id || r.activityCreatedById === actor.id);
    }
    if (view === 'pending') {
      rows = rows.filter((r) => PENDING_ACCOUNTABILITY_STATUSES.includes(r.status as (typeof PENDING_ACCOUNTABILITY_STATUSES)[number]));
    }
    if (view === 'approved') rows = rows.filter((r) => r.status === 'approved');
    if (view === 'closed') rows = rows.filter((r) => r.status === 'closed');
    if (view === 'under_review') rows = rows.filter((r) => r.status === 'under_review');
    if (view === 'due') {
      rows = rows.filter((r) => !SETTLED_STATUSES.includes(r.status as (typeof SETTLED_STATUSES)[number]) && !isOverdue(r.dueDate, r.status));
    }
    if (view === 'overdue' || filters.overdue) {
      rows = rows.filter((r) => isOverdue(r.dueDate, r.status));
    }
    if (view === 'returned') rows = rows.filter((r) => r.status === 'returned');
    if (view === 'clarification') rows = rows.filter((r) => r.status === 'clarification_requested');
    if (view === 'review' && actor) {
      rows = rows.filter((r) => {
        if (!isReviewQueueStatus(r.status)) return false;
        if (r.reviewerId === actor.id) return true;
        if (!r.reviewerId && hasAccPermission(actor, ACC_PERMISSIONS.VIEW_ALL)) return true;
        return false;
      });
    }
    const sort = filters.sort || 'createdAt';
    const dir = filters.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av =
        sort === 'referenceNumber'
          ? a.referenceNumber
          : sort === 'dueDate'
            ? a.dueDate.getTime()
            : a.createdAt.getTime();
      const bv =
        sort === 'referenceNumber'
          ? b.referenceNumber
          : sort === 'dueDate'
            ? b.dueDate.getTime()
            : b.createdAt.getTime();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  }

  async financialTotals(filters: { actor?: Actor }) {
    const listed = await this.list({ actor: filters.actor, page: 1, limit: 100000 });
    let amountAdvanced = 0;
    let amountReturned = 0;
    let amountAccounted = 0;
    for (const row of listed.data) {
      amountAdvanced += Number(row.amountAdvanced || 0);
      amountReturned += Number(row.amountReturned || 0);
      amountAccounted += row.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    }
    return {
      amountAdvanced,
      amountAccounted,
      amountReturned,
      outstanding: outstanding(amountAdvanced, amountAccounted, amountReturned),
      variance: variance(amountAdvanced, amountAccounted, amountReturned),
    };
  }

  async getById(id: string) {
    const found = this.cases.get(id);
    return found ? this.snapshot(found) : null;
  }

  async findOpenByActivity(activityId: string) {
    for (const row of this.cases.values()) {
      if (row.activityId === activityId && isOpenStatus(row.status)) return this.snapshot(row);
    }
    return null;
  }

  async create(input: {
    referenceNumber: string;
    activityId: string;
    status: string;
    amountAdvanced: number;
    amountReturned: number;
    dueDate: Date;
    submittedById: string;
    personId?: string | null;
    lines: { kind: string; description: string; amount: number }[];
  }) {
    const id = randomUUID();
    const now = new Date();
    const activity = this.activities.activities.get(input.activityId);
    const lines: AccLineRow[] = input.lines.map((l, i) => ({
      id: randomUUID(),
      accountabilityId: id,
      kind: l.kind,
      description: l.description,
      amount: l.amount,
      sortOrder: i,
    }));
    const row: AccountabilityRecord = {
      id,
      referenceNumber: input.referenceNumber,
      activityId: input.activityId,
      status: input.status,
      currency: 'UGX',
      amountAdvanced: input.amountAdvanced,
      amountReturned: input.amountReturned,
      dueDate: input.dueDate,
      submittedById: input.submittedById,
      personId: input.personId ?? null,
      submittedAt: null,
      reviewerId: null,
      assignedAt: null,
      assignedById: null,
      reviewedAt: null,
      approvedAt: null,
      approvedById: null,
      rejectedAt: null,
      rejectedById: null,
      rejectionReason: null,
      closedAt: null,
      closedById: null,
      closureReason: null,
      returnReason: null,
      createdAt: now,
      updatedAt: now,
      activityTitle: activity?.title || '',
      activityDepartmentName: activity?.departmentName ?? null,
      activityCreatedById: activity?.createdById || '',
      activityHasReport: activity?.documents.some((d) => d.kind === 'activity_report') ?? false,
      lines,
      documents: [],
      clarifications: [],
      comments: [],
    };
    this.cases.set(id, row);
    return this.snapshot(row);
  }

  async update(id: string, patch: Parameters<AccountabilityRepository['update']>[1]) {
    const current = this.cases.get(id);
    if (!current) throw new Error('missing');
    if (patch.lines) {
      current.lines = patch.lines.map((l, i) => ({
        id: randomUUID(),
        accountabilityId: id,
        kind: l.kind,
        description: l.description,
        amount: l.amount,
        sortOrder: i,
      }));
    }
    Object.assign(current, { ...patch, lines: current.lines, updatedAt: new Date() });
    return this.snapshot(current);
  }

  async addDocument(id: string, doc: Omit<AccDocumentRow, 'id' | 'accountabilityId' | 'createdAt'>) {
    const current = this.cases.get(id);
    if (!current) throw new Error('missing');
    current.documents.push({
      id: randomUUID(),
      accountabilityId: id,
      createdAt: new Date(),
      ...doc,
    });
    current.updatedAt = new Date();
    return this.snapshot(current);
  }

  async addEvent(event: Omit<AccEventRow, 'id' | 'createdAt'>) {
    const row: AccEventRow = { id: randomUUID(), createdAt: new Date(), ...event };
    this.events.push(row);
    return row;
  }

  async timeline(id: string) {
    return this.events
      .filter((e) => e.accountabilityId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async addComment(comment: Omit<AccCommentRow, 'id' | 'createdAt'>) {
    const current = this.cases.get(comment.accountabilityId);
    if (!current) throw new Error('missing');
    const row: AccCommentRow = { id: randomUUID(), createdAt: new Date(), ...comment };
    current.comments.push(row);
    return row;
  }

  async addClarification(row: { accountabilityId: string; question: string; requestedById: string }) {
    const current = this.cases.get(row.accountabilityId);
    if (!current) throw new Error('missing');
    const item: AccClarificationRow = {
      id: randomUUID(),
      accountabilityId: row.accountabilityId,
      question: row.question,
      requestedById: row.requestedById,
      requestedAt: new Date(),
      response: null,
      respondedById: null,
      respondedAt: null,
      status: 'open',
    };
    current.clarifications.push(item);
    return item;
  }

  async respondClarification(id: string, clarificationId: string, response: string, actorId: string) {
    const current = this.cases.get(id);
    if (!current) throw new Error('missing');
    const item = current.clarifications.find((c) => c.id === clarificationId);
    if (!item) throw new Error('missing clarification');
    item.response = response;
    item.respondedById = actorId;
    item.respondedAt = new Date();
    item.status = 'answered';
    return { ...item };
  }
}

export class MemoryIdentityLookup implements IdentityLookup {
  constructor(private readonly users: Actor[]) {}

  async getById(id: string) {
    return this.users.find((u) => u.id === id) || null;
  }

  async listReviewers() {
    return this.users.filter((u) => hasAccPermission(u, ACC_PERMISSIONS.REVIEW));
  }

  async listAll() {
    return [...this.users];
  }
}
