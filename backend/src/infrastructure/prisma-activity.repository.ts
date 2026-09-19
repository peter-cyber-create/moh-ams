import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
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
import type { ParticipantRecord } from '../domain/activity/participants.js';

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function mapParticipant(p: {
  id: string;
  activityId: string;
  personId?: string | null;
  name: string;
  title: string | null;
  phone: string | null;
  amount: Prisma.Decimal;
  days: number;
  sortOrder: number;
}): ParticipantRow {
  return {
    id: p.id,
    activityId: p.activityId,
    personId: p.personId ?? null,
    name: p.name,
    title: p.title,
    phone: p.phone,
    amount: num(p.amount),
    days: p.days,
    sortOrder: p.sortOrder,
  };
}

function mapDoc(d: {
  id: string;
  activityId: string;
  kind: string;
  storedPath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedById: string | null;
  createdAt: Date;
}): DocumentRow {
  return { ...d };
}

function toAggregate(row: {
  id: string;
  financeActivityId: string | null;
  title: string;
  description: string | null;
  requestedBy: string | null;
  location: string | null;
  departmentId: string | null;
  departmentName: string | null;
  activityDate: Date | null;
  endDate: Date | null;
  budgetAmount: Prisma.Decimal;
  funder: string | null;
  referenceNumber: string | null;
  activityType: string | null;
  days: number | null;
  status: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  participants: Parameters<typeof mapParticipant>[0][];
  documents: Parameters<typeof mapDoc>[0][];
}): ActivityAggregate {
  return {
    id: row.id,
    financeActivityId: row.financeActivityId,
    title: row.title,
    description: row.description,
    requestedBy: row.requestedBy,
    location: row.location,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    activityDate: row.activityDate,
    endDate: row.endDate,
    budgetAmount: num(row.budgetAmount),
    funder: row.funder,
    referenceNumber: row.referenceNumber,
    activityType: row.activityType,
    days: row.days,
    status: row.status,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    participants: row.participants.map(mapParticipant),
    documents: row.documents.map(mapDoc),
  };
}

const include = { participants: { orderBy: { sortOrder: 'asc' as const } }, documents: true };

export class PrismaActivityRepository implements ActivityRepository {
  async list(filters: ListFilters) {
    const where: Prisma.ActivityWhereInput = {};
    if (filters.excludeDrafts !== false) where.status = { not: 'draft' };
    if (filters.status) where.status = filters.status;
    if (filters.createdById) where.createdById = filters.createdById;
    if (filters.funder) where.funder = filters.funder;
    if (filters.search?.trim()) where.title = { contains: filters.search.trim(), mode: 'insensitive' };
    if (filters.missingReport) {
      where.AND = [
        { status: { notIn: ['draft', 'closed', 'cancelled'] } },
        { documents: { none: { kind: 'activity_report' } } },
      ];
    }
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const sort = filters.sort || 'createdAt';
    const order = filters.order === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);
    return { data: rows.map(toAggregate), total, page, limit };
  }

  private yearScope(year: number): Prisma.ActivityWhereInput {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return {
      OR: [{ activityDate: { gte: start, lt: end } }, { activityDate: null, createdAt: { gte: start, lt: end } }],
    };
  }

  async countStats(filters: ActivityCountFilters): Promise<ActivityCountStats> {
    const now = filters.now || new Date();
    const month = filters.month ?? now.getUTCMonth();
    const monthStart = new Date(Date.UTC(filters.year, month, 1));
    const monthEnd = new Date(Date.UTC(filters.year, month + 1, 1));
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const base: Prisma.ActivityWhereInput = {
      status: { notIn: ['draft', 'cancelled'] },
      AND: [this.yearScope(filters.year)],
    };
    if (filters.createdById) base.createdById = filters.createdById;

    const [total, thisMonth, ongoing, upcoming, reportsPending, reportsSubmitted, recentlyClosed] = await Promise.all([
      prisma.activity.count({ where: base }),
      prisma.activity.count({
        where: { ...base, activityDate: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.activity.count({ where: { ...base, status: 'ongoing' } }),
      prisma.activity.count({
        where: { ...base, status: 'planned', activityDate: { gt: startOfToday } },
      }),
      prisma.activity.count({
        where: {
          ...base,
          status: { notIn: ['closed', 'cancelled'] },
          documents: { none: { kind: 'activity_report' } },
        },
      }),
      prisma.activity.count({ where: { ...base, status: 'report_submitted' } }),
      prisma.activity.count({
        where: {
          ...base,
          status: 'closed',
          updatedAt: { gte: new Date(startOfToday.getTime() - 30 * 86400000) },
        },
      }),
    ]);
    return { total, thisMonth, ongoing, upcoming, reportsPending, reportsSubmitted, recentlyClosed };
  }

  async getById(id: string) {
    const row = await prisma.activity.findUnique({ where: { id }, include });
    return row ? toAggregate(row) : null;
  }

  async create(input: CreateActivityInput) {
    const row = await prisma.activity.create({
      data: {
        title: input.title,
        description: input.description,
        requestedBy: input.requestedBy,
        location: input.location,
        departmentId: input.departmentId,
        departmentName: input.departmentName,
        activityDate: input.activityDate ?? undefined,
        endDate: input.endDate ?? undefined,
        budgetAmount: input.budgetAmount,
        funder: input.funder,
        referenceNumber: input.referenceNumber,
        activityType: input.activityType,
        days: input.days ?? undefined,
        status: input.status,
        createdById: input.createdById,
        participants: {
          create: (input.participants || []).map((p, i) => ({
            name: p.name,
            title: p.title || null,
            phone: p.phone || null,
            amount: p.amount,
            days: p.days,
            sortOrder: i,
            personId: p.personId || null,
          })),
        },
      },
      include,
    });
    return toAggregate(row);
  }

  async update(id: string, input: UpdateActivityInput) {
    const data: Prisma.ActivityUpdateInput = {
      title: input.title,
      description: input.description,
      requestedBy: input.requestedBy,
      location: input.location,
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      activityDate: input.activityDate,
      endDate: input.endDate,
      budgetAmount: input.budgetAmount,
      funder: input.funder,
      referenceNumber: input.referenceNumber,
      activityType: input.activityType,
      days: input.days,
      status: input.status,
    };
    if (input.participants) {
      data.participants = {
        deleteMany: {},
        create: input.participants.map((p, i) => ({
          name: p.name,
          title: p.title || null,
          phone: p.phone || null,
          amount: p.amount,
          days: p.days,
          sortOrder: i,
          personId: p.personId || null,
        })),
      };
    }
    const row = await prisma.activity.update({ where: { id }, data, include });
    return toAggregate(row);
  }

  async delete(id: string) {
    await prisma.activity.delete({ where: { id } });
  }

  async replaceParticipants(id: string, participants: ParticipantRecord[]) {
    return this.update(id, { participants });
  }

  async addDocument(id: string, doc: Omit<DocumentRow, 'id' | 'activityId' | 'createdAt'> & { createdAt?: Date }) {
    await prisma.activityDocument.create({
      data: {
        activityId: id,
        kind: doc.kind,
        storedPath: doc.storedPath,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        uploadedById: doc.uploadedById,
        createdAt: doc.createdAt,
      },
    });
    const row = await prisma.activity.findUniqueOrThrow({ where: { id }, include });
    return toAggregate(row);
  }

  async addEvent(event: Omit<EventRow, 'id' | 'createdAt'> & { createdAt?: Date }) {
    return prisma.activityEvent.create({
      data: {
        activityId: event.activityId,
        action: event.action,
        summary: event.summary,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        meta: event.meta === undefined ? undefined : (event.meta as Prisma.InputJsonValue),
        actorUserId: event.actorUserId,
        createdAt: event.createdAt,
      },
    });
  }

  async timeline(id: string) {
    return prisma.activityEvent.findMany({
      where: { activityId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async allParticipants() {
    const rows = await prisma.activityParticipant.findMany({
      where: { activity: { status: { not: 'draft' } } },
      include: { activity: true },
    });
    return rows.map((p) => ({
      ...mapParticipant(p),
      activityTitle: p.activity.title,
      activityDate: p.activity.activityDate,
      endDate: p.activity.endDate,
      activityDays: p.activity.days,
      activityStatus: p.activity.status,
      departmentName: p.activity.departmentName,
      funder: p.activity.funder,
      referenceNumber: p.activity.referenceNumber,
    }));
  }
}

export function activityNeedsReport(status: string, hasReport: boolean) {
  return needsActivityReport(status, hasReport);
}
