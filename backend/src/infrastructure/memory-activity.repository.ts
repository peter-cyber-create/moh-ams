import { randomUUID } from 'node:crypto';
import type { ParticipantRecord } from '../domain/activity/participants.js';
import { needsActivityReport } from '../domain/activity/statuses.js';
import type { ActivityAggregate, DocumentRow, EventRow, ParticipantRow } from '../domain/activity/types.js';
import type {
  ActivityRepository,
  ActivityCountFilters,
  ActivityCountStats,
  CreateActivityInput,
  ListFilters,
  UpdateActivityInput,
} from '../application/activity/ports.js';

function clone(activity: ActivityAggregate): ActivityAggregate {
  return {
    ...activity,
    participants: activity.participants.map((p) => ({ ...p })),
    documents: activity.documents.map((d) => ({ ...d })),
  };
}

export class MemoryActivityRepository implements ActivityRepository {
  activities = new Map<string, ActivityAggregate>();
  events: EventRow[] = [];

  async list(filters: ListFilters) {
    let rows = [...this.activities.values()];
    if (filters.excludeDrafts !== false) rows = rows.filter((a) => a.status !== 'draft');
    if (filters.status) rows = rows.filter((a) => a.status === filters.status);
    if (filters.createdById) rows = rows.filter((a) => a.createdById === filters.createdById);
    if (filters.funder) rows = rows.filter((a) => a.funder === filters.funder);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (filters.missingReport) {
      rows = rows.filter((a) =>
        needsActivityReport(
          a.status,
          a.documents.some((d) => d.kind === 'activity_report'),
        ),
      );
    }
    const sort = filters.sort || 'createdAt';
    const dir = filters.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = sort === 'title' ? a.title : sort === 'activityDate' ? a.activityDate?.getTime() || 0 : a.createdAt.getTime();
      const bv = sort === 'title' ? b.title : sort === 'activityDate' ? b.activityDate?.getTime() || 0 : b.createdAt.getTime();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit).map(clone);
    return { data, total, page, limit };
  }

  private inYear(activity: ActivityAggregate, year: number) {
    const start = Date.UTC(year, 0, 1);
    const end = Date.UTC(year + 1, 0, 1);
    const date = activity.activityDate || activity.createdAt;
    const t = date?.getTime?.() || 0;
    return t >= start && t < end;
  }

  async countStats(filters: ActivityCountFilters): Promise<ActivityCountStats> {
    const now = filters.now || new Date();
    const month = filters.month ?? now.getUTCMonth();
    const monthStart = Date.UTC(filters.year, month, 1);
    const monthEnd = Date.UTC(filters.year, month + 1, 1);
    const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    let rows = [...this.activities.values()].filter(
      (a) => a.status !== 'draft' && a.status !== 'cancelled' && this.inYear(a, filters.year),
    );
    if (filters.createdById) rows = rows.filter((a) => a.createdById === filters.createdById);

    const thisMonth = rows.filter((a) => {
      const t = (a.activityDate || a.createdAt)?.getTime?.() || 0;
      return t >= monthStart && t < monthEnd;
    }).length;
    const ongoing = rows.filter((a) => a.status === 'ongoing').length;
    const upcoming = rows.filter((a) => {
      const t = a.activityDate?.getTime?.() || 0;
      return a.status === 'planned' && t > startOfToday;
    }).length;
    const reportsPending = rows.filter((a) =>
      needsActivityReport(a.status, a.documents.some((d) => d.kind === 'activity_report')),
    ).length;
    const reportsSubmitted = rows.filter((a) => a.status === 'report_submitted').length;
    const thirtyDaysAgo = startOfToday - 30 * 86400000;
    const recentlyClosed = rows.filter(
      (a) => a.status === 'closed' && (a.updatedAt?.getTime?.() || 0) >= thirtyDaysAgo,
    ).length;

    return { total: rows.length, thisMonth, ongoing, upcoming, reportsPending, reportsSubmitted, recentlyClosed };
  }

  async getById(id: string) {
    const found = this.activities.get(id);
    return found ? clone(found) : null;
  }

  async create(input: CreateActivityInput) {
    const id = randomUUID();
    const now = new Date();
    const participants: ParticipantRow[] = (input.participants || []).map((p, i) => ({
      id: randomUUID(),
      activityId: id,
      personId: p.personId ?? null,
      name: p.name,
      title: p.title || null,
      phone: p.phone || null,
      amount: p.amount,
      days: p.days,
      sortOrder: i,
    }));
    const row: ActivityAggregate = {
      id,
      financeActivityId: null,
      title: input.title,
      description: input.description ?? null,
      requestedBy: input.requestedBy ?? null,
      location: input.location ?? null,
      departmentId: input.departmentId ?? null,
      departmentName: input.departmentName ?? null,
      activityDate: input.activityDate ?? null,
      endDate: input.endDate ?? null,
      budgetAmount: input.budgetAmount,
      funder: input.funder ?? null,
      referenceNumber: input.referenceNumber ?? null,
      activityType: input.activityType ?? null,
      days: input.days ?? null,
      status: input.status,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
      participants,
      documents: [],
    };
    this.activities.set(id, row);
    return clone(row);
  }

  async update(id: string, input: UpdateActivityInput) {
    const current = this.activities.get(id);
    if (!current) throw new Error('missing');
    Object.assign(current, {
      ...input,
      participants: current.participants,
      documents: current.documents,
      updatedAt: new Date(),
    });
    if (input.participants) {
      current.participants = input.participants.map((p, i) => ({
        id: randomUUID(),
        activityId: id,
        personId: p.personId ?? null,
        name: p.name,
        title: p.title || null,
        phone: p.phone || null,
        amount: p.amount,
        days: p.days,
        sortOrder: i,
      }));
    }
    return clone(current);
  }

  async delete(id: string) {
    this.activities.delete(id);
    this.events = this.events.filter((e) => e.activityId !== id);
  }

  async replaceParticipants(id: string, participants: ParticipantRecord[]) {
    return this.update(id, { participants });
  }

  async addDocument(id: string, doc: Omit<DocumentRow, 'id' | 'activityId' | 'createdAt'> & { createdAt?: Date }) {
    const current = this.activities.get(id);
    if (!current) throw new Error('missing');
    current.documents.push({
      id: randomUUID(),
      activityId: id,
      createdAt: doc.createdAt || new Date(),
      ...doc,
    });
    current.updatedAt = new Date();
    return clone(current);
  }

  async addEvent(event: Omit<EventRow, 'id' | 'createdAt'> & { createdAt?: Date }) {
    const row: EventRow = {
      id: randomUUID(),
      createdAt: event.createdAt || new Date(),
      ...event,
    };
    this.events.push(row);
    return row;
  }

  async timeline(id: string) {
    return this.events.filter((e) => e.activityId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async allParticipants() {
    const rows: (ParticipantRow & {
      activityTitle: string;
      activityDate: Date | null;
      endDate: Date | null;
      activityDays: number | null;
      activityStatus: string;
      departmentName: string | null;
      funder: string | null;
      referenceNumber: string | null;
    })[] = [];
    for (const a of this.activities.values()) {
      if (a.status === 'draft') continue;
      for (const p of a.participants) {
        rows.push({
          ...p,
          activityTitle: a.title,
          activityDate: a.activityDate,
          endDate: a.endDate,
          activityDays: a.days,
          activityStatus: a.status,
          departmentName: a.departmentName,
          funder: a.funder,
          referenceNumber: a.referenceNumber,
        });
      }
    }
    return rows;
  }
}

export class MemoryFileStore {
  async save(file: { originalname: string; mimetype?: string; size?: number }) {
    return {
      storedPath: `/uploads/reports/${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype || null,
      sizeBytes: file.size ?? null,
    };
  }
}
