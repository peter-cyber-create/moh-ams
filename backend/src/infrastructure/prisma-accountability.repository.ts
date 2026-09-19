import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { outstanding, variance } from '../domain/accountability/finance.js';
import { formatReference, SETTLED_STATUSES } from '../domain/accountability/statuses.js';
import { PENDING_ACCOUNTABILITY_STATUSES } from '../domain/compliance/accountability.js';
import { ACC_PERMISSIONS, hasAccPermission } from '../domain/accountability/permissions.js';
import type { Actor } from '../domain/activity/permissions.js';
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

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

const include = {
  lines: { orderBy: { sortOrder: 'asc' as const } },
  documents: { orderBy: { createdAt: 'asc' as const } },
  clarifications: { orderBy: { requestedAt: 'asc' as const } },
  comments: { orderBy: { createdAt: 'asc' as const } },
  activity: {
    select: {
      title: true,
      departmentName: true,
      createdById: true,
      documents: { where: { kind: 'activity_report' }, select: { id: true }, take: 1 },
    },
  },
} satisfies Prisma.AccountabilityInclude;

type Row = Prisma.AccountabilityGetPayload<{ include: typeof include }>;

function mapLine(l: Row['lines'][number]): AccLineRow {
  return {
    id: l.id,
    accountabilityId: l.accountabilityId,
    kind: l.kind,
    description: l.description,
    amount: num(l.amount),
    sortOrder: l.sortOrder,
  };
}

function mapDoc(d: Row['documents'][number]): AccDocumentRow {
  return {
    id: d.id,
    accountabilityId: d.accountabilityId,
    kind: d.kind,
    storedPath: d.storedPath,
    originalName: d.originalName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    uploadedById: d.uploadedById,
    createdAt: d.createdAt,
  };
}

function mapClarification(c: Row['clarifications'][number]): AccClarificationRow {
  return {
    id: c.id,
    accountabilityId: c.accountabilityId,
    question: c.question,
    requestedById: c.requestedById,
    requestedAt: c.requestedAt,
    response: c.response,
    respondedById: c.respondedById,
    respondedAt: c.respondedAt,
    status: c.status,
  };
}

function mapComment(c: Row['comments'][number]): AccCommentRow {
  return {
    id: c.id,
    accountabilityId: c.accountabilityId,
    kind: c.kind,
    body: c.body,
    actorUserId: c.actorUserId,
    createdAt: c.createdAt,
  };
}

function toRecord(row: Row): AccountabilityRecord {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    activityId: row.activityId,
    status: row.status,
    currency: row.currency,
    amountAdvanced: num(row.amountAdvanced),
    amountReturned: num(row.amountReturned),
    dueDate: row.dueDate,
    submittedById: row.submittedById,
    personId: row.personId ?? null,
    submittedAt: row.submittedAt,
    reviewerId: row.reviewerId,
    assignedAt: row.assignedAt,
    assignedById: row.assignedById,
    reviewedAt: row.reviewedAt,
    approvedAt: row.approvedAt,
    approvedById: row.approvedById,
    rejectedAt: row.rejectedAt,
    rejectedById: row.rejectedById,
    rejectionReason: row.rejectionReason,
    closedAt: row.closedAt,
    closedById: row.closedById,
    closureReason: row.closureReason,
    returnReason: row.returnReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    activityTitle: row.activity.title,
    activityDepartmentName: row.activity.departmentName,
    activityCreatedById: row.activity.createdById,
    activityHasReport: row.activity.documents.length > 0,
    lines: row.lines.map(mapLine),
    documents: row.documents.map(mapDoc),
    clarifications: row.clarifications.map(mapClarification),
    comments: row.comments.map(mapComment),
  };
}

function mapEvent(e: {
  id: string;
  accountabilityId: string;
  action: string;
  summary: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  meta: Prisma.JsonValue | null;
  actorUserId: string | null;
  createdAt: Date;
}): AccEventRow {
  return {
    id: e.id,
    accountabilityId: e.accountabilityId,
    action: e.action,
    summary: e.summary,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    meta: e.meta,
    actorUserId: e.actorUserId,
    createdAt: e.createdAt,
  };
}

export class PrismaAccountabilityRepository implements AccountabilityRepository {
  async nextReference(year: number) {
    const row = await prisma.accountabilitySequence.upsert({
      where: { year },
      create: { year, last: 1 },
      update: { last: { increment: 1 } },
    });
    return formatReference(year, row.last);
  }

  async list(filters: AccListFilters) {
    const where: Prisma.AccountabilityWhereInput = {};
    const and: Prisma.AccountabilityWhereInput[] = [];
    const actor = filters.actor;
    if (actor && !hasAccPermission(actor, ACC_PERMISSIONS.VIEW_ALL) && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) {
      and.push({
        OR: [{ submittedById: actor.id }, { reviewerId: actor.id }, { activity: { createdById: actor.id } }],
      });
    }
    if (filters.activityId) and.push({ activityId: filters.activityId });
    if (filters.reviewerId) and.push({ reviewerId: filters.reviewerId });
    if (filters.submittedById) and.push({ submittedById: filters.submittedById });
    if (filters.status) and.push({ status: filters.status });
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      and.push({
        OR: [
          { referenceNumber: { contains: q, mode: 'insensitive' } },
          { activity: { title: { contains: q, mode: 'insensitive' } } },
          { activity: { departmentName: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    if (filters.department?.trim()) {
      and.push({ activity: { departmentName: { contains: filters.department.trim(), mode: 'insensitive' } } });
    }
    const view = filters.view;
    if (view === 'mine' && actor) {
      and.push({ OR: [{ submittedById: actor.id }, { activity: { createdById: actor.id } }] });
    }
    if (view === 'pending') {
      and.push({ status: { in: [...PENDING_ACCOUNTABILITY_STATUSES] } });
    }
    if (view === 'approved') and.push({ status: 'approved' });
    if (view === 'closed') and.push({ status: 'closed' });
    if (view === 'under_review') and.push({ status: 'under_review' });
    if (view === 'due') {
      and.push({ status: { notIn: [...SETTLED_STATUSES] }, dueDate: { gte: new Date() } });
    }
    if (view === 'overdue' || filters.overdue) {
      and.push({ status: { notIn: [...SETTLED_STATUSES] }, dueDate: { lt: new Date() } });
    }
    if (view === 'returned') and.push({ status: 'returned' });
    if (view === 'clarification') and.push({ status: 'clarification_requested' });
    if (view === 'review' && actor) {
      const reviewOr: Prisma.AccountabilityWhereInput[] = [{ reviewerId: actor.id }];
      if (hasAccPermission(actor, ACC_PERMISSIONS.VIEW_ALL)) reviewOr.push({ reviewerId: null });
      and.push({ status: { in: ['submitted', 'under_review', 'resubmitted'] }, OR: reviewOr });
    }
    if (and.length) where.AND = and;

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const sort = filters.sort || 'createdAt';
    const order = filters.order === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      prisma.accountability.findMany({
        where,
        include,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.accountability.count({ where }),
    ]);
    return { data: rows.map(toRecord), total, page, limit };
  }

  async financialTotals(filters: { actor?: Actor }) {
    const and: Prisma.AccountabilityWhereInput[] = [];
    const actor = filters.actor;
    if (actor && !hasAccPermission(actor, ACC_PERMISSIONS.VIEW_ALL) && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) {
      and.push({
        OR: [{ submittedById: actor.id }, { reviewerId: actor.id }, { activity: { createdById: actor.id } }],
      });
    }
    const where: Prisma.AccountabilityWhereInput = and.length ? { AND: and } : {};
    const rows = await prisma.accountability.findMany({
      where,
      select: { amountAdvanced: true, amountReturned: true, lines: { select: { amount: true } } },
    });
    let amountAdvanced = 0;
    let amountReturned = 0;
    let amountAccounted = 0;
    for (const row of rows) {
      amountAdvanced += num(row.amountAdvanced);
      amountReturned += num(row.amountReturned);
      amountAccounted += row.lines.reduce((sum, line) => sum + num(line.amount), 0);
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
    const row = await prisma.accountability.findUnique({ where: { id }, include });
    return row ? toRecord(row) : null;
  }

  async findOpenByActivity(activityId: string) {
    const row = await prisma.accountability.findFirst({
      where: { activityId, status: { notIn: ['rejected', 'closed'] } },
      include,
    });
    return row ? toRecord(row) : null;
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
    const row = await prisma.accountability.create({
      data: {
        referenceNumber: input.referenceNumber,
        activityId: input.activityId,
        personId: input.personId ?? null,
        status: input.status,
        amountAdvanced: input.amountAdvanced,
        amountReturned: input.amountReturned,
        dueDate: input.dueDate,
        submittedById: input.submittedById,
        lines: {
          create: input.lines.map((l, i) => ({
            kind: l.kind,
            description: l.description,
            amount: l.amount,
            sortOrder: i,
          })),
        },
      },
      include,
    });
    return toRecord(row);
  }

  async update(id: string, patch: Parameters<AccountabilityRepository['update']>[1]) {
    const { lines, ...rest } = patch;
    const row = await prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.accountabilityLine.deleteMany({ where: { accountabilityId: id } });
        await tx.accountabilityLine.createMany({
          data: lines.map((l, i) => ({
            accountabilityId: id,
            kind: l.kind,
            description: l.description,
            amount: l.amount,
            sortOrder: i,
          })),
        });
      }
      return tx.accountability.update({
        where: { id },
        data: rest,
        include,
      });
    });
    return toRecord(row);
  }

  async addDocument(id: string, doc: Omit<AccDocumentRow, 'id' | 'accountabilityId' | 'createdAt'>) {
    await prisma.accountabilityDocument.create({
      data: {
        accountabilityId: id,
        kind: doc.kind,
        storedPath: doc.storedPath,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        uploadedById: doc.uploadedById,
      },
    });
    const row = await prisma.accountability.findUniqueOrThrow({ where: { id }, include });
    return toRecord(row);
  }

  async addEvent(event: Omit<AccEventRow, 'id' | 'createdAt'>) {
    const row = await prisma.accountabilityEvent.create({
      data: {
        accountabilityId: event.accountabilityId,
        action: event.action,
        summary: event.summary,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        meta: event.meta === undefined ? undefined : (event.meta as Prisma.InputJsonValue),
        actorUserId: event.actorUserId,
      },
    });
    return mapEvent(row);
  }

  async timeline(id: string) {
    const rows = await prisma.accountabilityEvent.findMany({
      where: { accountabilityId: id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapEvent);
  }

  async addComment(comment: Omit<AccCommentRow, 'id' | 'createdAt'>) {
    const row = await prisma.accountabilityComment.create({
      data: {
        accountabilityId: comment.accountabilityId,
        kind: comment.kind,
        body: comment.body,
        actorUserId: comment.actorUserId,
      },
    });
    return {
      id: row.id,
      accountabilityId: row.accountabilityId,
      kind: row.kind,
      body: row.body,
      actorUserId: row.actorUserId,
      createdAt: row.createdAt,
    };
  }

  async addClarification(input: { accountabilityId: string; question: string; requestedById: string }) {
    const row = await prisma.accountabilityClarification.create({
      data: {
        accountabilityId: input.accountabilityId,
        question: input.question,
        requestedById: input.requestedById,
        status: 'open',
      },
    });
    return mapClarification(row as Row['clarifications'][number]);
  }

  async respondClarification(id: string, clarificationId: string, response: string, actorId: string) {
    const row = await prisma.accountabilityClarification.update({
      where: { id: clarificationId },
      data: {
        response,
        respondedById: actorId,
        respondedAt: new Date(),
        status: 'answered',
      },
    });
    if (row.accountabilityId !== id) throw new Error('clarification mismatch');
    return mapClarification(row as Row['clarifications'][number]);
  }
}

function mapActor(u: {
  id: string;
  email: string;
  name: string;
  module: string | null;
  roleName: string | null;
  isActive: boolean;
}): Actor {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    module: u.module,
    roleName: u.roleName,
    isActive: u.isActive,
  };
}

export class PrismaIdentityLookup implements IdentityLookup {
  async getById(id: string) {
    const u = await prisma.identityUser.findUnique({ where: { id } });
    return u ? mapActor(u) : null;
  }

  async listReviewers() {
    const users = await prisma.identityUser.findMany({ where: { isActive: true } });
    return users.map(mapActor).filter((a) => hasAccPermission(a, ACC_PERMISSIONS.REVIEW));
  }
}
