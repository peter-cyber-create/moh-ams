import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { normalizeName, normalizePhone } from '../domain/compliance/identity.js';
import { normalizeEmail } from '../domain/person/matching.js';
import { formatPersonReference, type PersonIdentityStatus, type PersonRecord } from '../domain/person/types.js';
import { activityDuration } from '../domain/compliance/participation.js';
import type {
  CreatePersonInput,
  LinkedParticipant,
  PersonListFilters,
  PersonRepository,
  QualitySample,
  QualitySnapshot,
} from '../application/person/ports.js';

function mapPerson(row: {
  id: string;
  personReference: string;
  fullName: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  organisation: string | null;
  title: string | null;
  departmentId: string | null;
  departmentName: string | null;
  identityStatus: string;
  identityUserId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): PersonRecord {
  return {
    ...row,
    identityStatus: row.identityStatus as PersonIdentityStatus,
  };
}

function sample(id: string, label: string, detail?: string | null): QualitySample {
  return { id, label, detail: detail ?? null };
}

export class PrismaPersonRepository implements PersonRepository {
  async nextReference() {
    const seq = await prisma.personSequence.upsert({
      where: { id: 1 },
      update: { last: { increment: 1 } },
      create: { id: 1, last: 1 },
    });
    return formatPersonReference(seq.last);
  }

  async create(input: CreatePersonInput & { personReference: string }) {
    const row = await prisma.person.create({
      data: {
        personReference: input.personReference,
        fullName: input.fullName,
        phone: input.phone ?? null,
        phoneNormalized: normalizePhone(input.phone),
        email: input.email ?? null,
        organisation: input.organisation ?? null,
        title: input.title ?? null,
        departmentId: input.departmentId ?? null,
        departmentName: input.departmentName ?? null,
        identityStatus: input.identityStatus || 'unverified',
        identityUserId: input.identityUserId ?? null,
      },
    });
    return mapPerson(row);
  }

  async update(
    id: string,
    patch: Partial<Omit<CreatePersonInput, 'identityUserId'>> & { identityUserId?: string | null; status?: string },
  ) {
    const data: Prisma.PersonUpdateInput = {};
    if (patch.fullName != null) data.fullName = patch.fullName;
    if (patch.phone !== undefined) {
      data.phone = patch.phone;
      data.phoneNormalized = normalizePhone(patch.phone);
    }
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.organisation !== undefined) data.organisation = patch.organisation;
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.departmentId !== undefined) data.departmentId = patch.departmentId;
    if (patch.departmentName !== undefined) data.departmentName = patch.departmentName;
    if (patch.identityStatus != null) data.identityStatus = patch.identityStatus;
    if (patch.status != null) data.status = patch.status;
    if (patch.identityUserId !== undefined) {
      data.identityUser = patch.identityUserId
        ? { connect: { id: patch.identityUserId } }
        : { disconnect: true };
    }
    const row = await prisma.person.update({ where: { id }, data });
    return mapPerson(row);
  }

  async getById(id: string) {
    const row = await prisma.person.findUnique({ where: { id } });
    return row ? mapPerson(row) : null;
  }

  async getByReference(reference: string) {
    const row = await prisma.person.findUnique({ where: { personReference: reference } });
    return row ? mapPerson(row) : null;
  }

  async getByIdentityUserId(userId: string) {
    const row = await prisma.person.findUnique({ where: { identityUserId: userId } });
    return row ? mapPerson(row) : null;
  }

  async findByPhoneNormalized(phoneNormalized: string) {
    const rows = await prisma.person.findMany({ where: { phoneNormalized } });
    return rows.map(mapPerson);
  }

  async findByEmail(email: string) {
    const key = normalizeEmail(email);
    if (!key) return [];
    const rows = await prisma.person.findMany({ where: { email: { equals: key, mode: 'insensitive' } } });
    return rows.map(mapPerson);
  }

  async nameExists(normalizedName: string, excludeId?: string) {
    const rows = await prisma.person.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
      select: { id: true, fullName: true },
    });
    return rows.some((p) => normalizeName(p.fullName) === normalizedName);
  }

  async list(filters: PersonListFilters) {
    const where: Prisma.PersonWhereInput = {};
    const and: Prisma.PersonWhereInput[] = [];
    if (filters.status) and.push({ status: filters.status });
    if (filters.identityStatus) and.push({ identityStatus: filters.identityStatus });
    if (filters.personReference) and.push({ personReference: { contains: filters.personReference, mode: 'insensitive' } });
    if (filters.organisation) and.push({ organisation: { contains: filters.organisation, mode: 'insensitive' } });
    if (filters.department) and.push({ departmentName: { contains: filters.department, mode: 'insensitive' } });
    if (filters.email) and.push({ email: { contains: filters.email, mode: 'insensitive' } });
    if (filters.phone) {
      const n = normalizePhone(filters.phone);
      and.push({
        OR: [{ phone: { contains: filters.phone } }, ...(n ? [{ phoneNormalized: n }] : [])],
      });
    }
    if (filters.search) {
      const q = filters.search.trim();
      const n = normalizePhone(q);
      and.push({
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { personReference: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
          { organisation: { contains: q, mode: 'insensitive' } },
          { departmentName: { contains: q, mode: 'insensitive' } },
          ...(n ? [{ phoneNormalized: n }] : []),
        ],
      });
    }
    if (and.length) where.AND = and;
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const [total, rows] = await prisma.$transaction([
      prisma.person.count({ where }),
      prisma.person.findMany({
        where,
        orderBy: { personReference: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows.map(mapPerson), total, page, limit };
  }

  async addEvent(event: {
    personId: string;
    action: string;
    summary?: string | null;
    meta?: unknown;
    actorUserId?: string | null;
  }) {
    return prisma.personEvent.create({
      data: {
        personId: event.personId,
        action: event.action,
        summary: event.summary,
        meta: event.meta === undefined ? undefined : (event.meta as Prisma.InputJsonValue),
        actorUserId: event.actorUserId,
      },
    });
  }

  async listEvents(personId: string) {
    return prisma.personEvent.findMany({ where: { personId }, orderBy: { createdAt: 'desc' } });
  }

  async getParticipant(participantId: string): Promise<LinkedParticipant | null> {
    const row = await prisma.activityParticipant.findUnique({ where: { id: participantId } });
    if (!row) return null;
    return { id: row.id, activityId: row.activityId, personId: row.personId, name: row.name, phone: row.phone };
  }

  async setParticipantPerson(participantId: string, personId: string): Promise<LinkedParticipant> {
    const row = await prisma.activityParticipant.update({
      where: { id: participantId },
      data: { personId },
    });
    return { id: row.id, activityId: row.activityId, personId: row.personId, name: row.name, phone: row.phone };
  }

  async qualitySnapshot(): Promise<QualitySnapshot> {
    const take = 50;
    const [people, participants, activities, users] = await Promise.all([
      prisma.person.findMany(),
      prisma.activityParticipant.findMany({ select: { id: true, activityId: true, personId: true, name: true, phone: true } }),
      prisma.activity.findMany({
        where: { status: { notIn: ['draft', 'cancelled'] } },
        select: { id: true, title: true, activityDate: true, endDate: true, days: true },
      }),
      prisma.identityUser.findMany({ include: { person: { select: { id: true } } } }),
    ]);

    const peopleWithoutPhone = people.filter((p) => !p.phoneNormalized);
    const byPhone = new Map<string, typeof people>();
    for (const p of people) {
      if (!p.phoneNormalized) continue;
      const list = byPhone.get(p.phoneNormalized) || [];
      list.push(p);
      byPhone.set(p.phoneNormalized, list);
    }
    const duplicatePeople = [...byPhone.values()].filter((g) => g.length > 1).flat();
    const participantsWithoutPerson = participants.filter((p) => !p.personId);
    const nameOnlyParticipants = participants.filter((p) => !normalizePhone(p.phone));
    const usersWithoutPerson = users.filter((u) => !u.person);
    const missingEnd = activities.filter((a) => a.activityDate && !a.endDate);
    const legacy = missingEnd.filter((a) => (a.days || 0) > 0);
    const crossYear = activities.filter((a) => activityDuration(a).crossYear);

    return {
      counts: {
        peopleWithoutPhone: peopleWithoutPhone.length,
        duplicatePhoneCandidates: duplicatePeople.length,
        participantsWithoutPerson: participantsWithoutPerson.length,
        identityUsersWithoutPerson: usersWithoutPerson.length,
        legacyDurationRecords: legacy.length,
        activitiesMissingEndDate: missingEnd.length,
        crossYearActivities: crossYear.length,
        nameOnlyParticipants: nameOnlyParticipants.length,
      },
      samples: {
        peopleWithoutPhone: peopleWithoutPhone.slice(0, take).map((p) => sample(p.id, p.fullName, p.personReference)),
        duplicatePhoneCandidates: duplicatePeople.slice(0, take).map((p) => sample(p.id, p.fullName, p.phone)),
        participantsWithoutPerson: participantsWithoutPerson.slice(0, take).map((p) => sample(p.id, p.name, p.activityId)),
        identityUsersWithoutPerson: usersWithoutPerson.slice(0, take).map((u) => sample(u.id, u.name, u.email)),
        legacyDurationRecords: legacy.slice(0, take).map((a) => sample(a.id, a.title, 'LEGACY_STORED_DAYS')),
        activitiesMissingEndDate: missingEnd.slice(0, take).map((a) => sample(a.id, a.title, 'missing_end_date')),
        crossYearActivities: crossYear.slice(0, take).map((a) => sample(a.id, a.title, 'CROSS_YEAR_REVIEW')),
        nameOnlyParticipants: nameOnlyParticipants.slice(0, take).map((p) => sample(p.id, p.name, 'name_only')),
      },
    };
  }
}
