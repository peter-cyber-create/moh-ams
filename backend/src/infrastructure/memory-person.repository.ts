import { randomUUID } from 'node:crypto';
import { normalizeName, normalizePhone } from '../domain/compliance/identity.js';
import { normalizeEmail } from '../domain/person/matching.js';
import { formatPersonReference } from '../domain/person/types.js';
import type { PersonEventRow, PersonIdentityStatus, PersonRecord } from '../domain/person/types.js';
import type {
  CreatePersonInput,
  LinkedParticipant,
  PersonListFilters,
  PersonRepository,
  QualitySample,
  QualitySnapshot,
} from '../application/person/ports.js';
import type { MemoryActivityRepository } from './memory-activity.repository.js';
import type { MemoryAccountabilityRepository, MemoryIdentityLookup } from './memory-accountability.repository.js';
import { activityDuration } from '../domain/compliance/participation.js';

function mapRecord(row: PersonRecord): PersonRecord {
  return { ...row };
}

export class MemoryPersonRepository implements PersonRepository {
  people = new Map<string, PersonRecord>();
  events: PersonEventRow[] = [];
  private seq = 0;

  constructor(
    private readonly activities?: MemoryActivityRepository,
    private readonly accountabilities?: MemoryAccountabilityRepository,
    private readonly identity?: MemoryIdentityLookup,
  ) {}

  async nextReference() {
    this.seq += 1;
    return formatPersonReference(this.seq);
  }

  async create(input: CreatePersonInput & { personReference: string }) {
    const now = new Date();
    const row: PersonRecord = {
      id: randomUUID(),
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
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.people.set(row.id, row);
    return mapRecord(row);
  }

  async update(
    id: string,
    patch: Partial<Omit<CreatePersonInput, 'identityUserId'>> & { identityUserId?: string | null; status?: string },
  ) {
    const current = this.people.get(id);
    if (!current) throw new Error('missing person');
    if (patch.fullName != null) current.fullName = patch.fullName;
    if (patch.phone !== undefined) {
      current.phone = patch.phone ?? null;
      current.phoneNormalized = normalizePhone(patch.phone);
    }
    if (patch.email !== undefined) current.email = patch.email ?? null;
    if (patch.organisation !== undefined) current.organisation = patch.organisation ?? null;
    if (patch.title !== undefined) current.title = patch.title ?? null;
    if (patch.departmentId !== undefined) current.departmentId = patch.departmentId ?? null;
    if (patch.departmentName !== undefined) current.departmentName = patch.departmentName ?? null;
    if (patch.identityStatus != null) current.identityStatus = patch.identityStatus as PersonIdentityStatus;
    if (patch.identityUserId !== undefined) current.identityUserId = patch.identityUserId;
    if (patch.status != null) current.status = patch.status;
    current.updatedAt = new Date();
    return mapRecord(current);
  }

  async getById(id: string) {
    const found = this.people.get(id);
    return found ? mapRecord(found) : null;
  }

  async getByReference(reference: string) {
    for (const row of this.people.values()) {
      if (row.personReference === reference) return mapRecord(row);
    }
    return null;
  }

  async getByIdentityUserId(userId: string) {
    for (const row of this.people.values()) {
      if (row.identityUserId === userId) return mapRecord(row);
    }
    return null;
  }

  async findByPhoneNormalized(phoneNormalized: string) {
    return [...this.people.values()].filter((p) => p.phoneNormalized === phoneNormalized).map(mapRecord);
  }

  async findByEmail(email: string) {
    const key = normalizeEmail(email);
    if (!key) return [];
    return [...this.people.values()].filter((p) => normalizeEmail(p.email) === key).map(mapRecord);
  }

  async nameExists(normalizedName: string, excludeId?: string) {
    return [...this.people.values()].some(
      (p) => p.id !== excludeId && normalizeName(p.fullName) === normalizedName,
    );
  }

  async list(filters: PersonListFilters) {
    let rows = [...this.people.values()];
    if (filters.status) rows = rows.filter((p) => p.status === filters.status);
    if (filters.identityStatus) rows = rows.filter((p) => p.identityStatus === filters.identityStatus);
    if (filters.personReference) {
      const q = filters.personReference.toUpperCase();
      rows = rows.filter((p) => p.personReference.includes(q));
    }
    if (filters.organisation) {
      const q = filters.organisation.toLowerCase();
      rows = rows.filter((p) => String(p.organisation || '').toLowerCase().includes(q));
    }
    if (filters.department) {
      const q = filters.department.toLowerCase();
      rows = rows.filter((p) => String(p.departmentName || '').toLowerCase().includes(q));
    }
    if (filters.phone) {
      const n = normalizePhone(filters.phone);
      rows = rows.filter((p) => p.phoneNormalized === n || String(p.phone || '').includes(filters.phone!));
    }
    if (filters.email) {
      const n = normalizeEmail(filters.email);
      rows = rows.filter((p) => normalizeEmail(p.email) === n);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const phoneQ = normalizePhone(filters.search);
      rows = rows.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.personReference.toLowerCase().includes(q) ||
          String(p.phone || '').includes(filters.search!) ||
          (phoneQ && p.phoneNormalized === phoneQ) ||
          String(p.email || '').toLowerCase().includes(q) ||
          String(p.organisation || '').toLowerCase().includes(q) ||
          String(p.departmentName || '').toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => a.personReference.localeCompare(b.personReference));
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const total = rows.length;
    return { data: rows.slice((page - 1) * limit, page * limit).map(mapRecord), total, page, limit };
  }

  async addEvent(event: {
    personId: string;
    action: string;
    summary?: string | null;
    meta?: unknown;
    actorUserId?: string | null;
  }) {
    const row: PersonEventRow = {
      id: randomUUID(),
      personId: event.personId,
      action: event.action,
      summary: event.summary ?? null,
      meta: event.meta ?? null,
      actorUserId: event.actorUserId ?? null,
      createdAt: new Date(),
    };
    this.events.push(row);
    return { ...row };
  }

  async listEvents(personId: string) {
    return this.events.filter((e) => e.personId === personId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getParticipant(participantId: string): Promise<LinkedParticipant | null> {
    if (!this.activities) return null;
    for (const activity of this.activities.activities.values()) {
      const found = activity.participants.find((p) => p.id === participantId);
      if (found) {
        return {
          id: found.id,
          activityId: found.activityId,
          personId: found.personId ?? null,
          name: found.name,
          phone: found.phone,
        };
      }
    }
    return null;
  }

  async setParticipantPerson(participantId: string, personId: string): Promise<LinkedParticipant> {
    if (!this.activities) throw new Error('activities not attached');
    for (const activity of this.activities.activities.values()) {
      const found = activity.participants.find((p) => p.id === participantId);
      if (found) {
        found.personId = personId;
        return {
          id: found.id,
          activityId: found.activityId,
          personId,
          name: found.name,
          phone: found.phone,
        };
      }
    }
    throw new Error('missing participant');
  }

  async qualitySnapshot(): Promise<QualitySnapshot> {
    const people = [...this.people.values()];
    const phoneGroups = new Map<string, PersonRecord[]>();
    for (const p of people) {
      if (!p.phoneNormalized) continue;
      const list = phoneGroups.get(p.phoneNormalized) || [];
      list.push(p);
      phoneGroups.set(p.phoneNormalized, list);
    }
    const duplicatePeople = [...phoneGroups.values()].filter((g) => g.length > 1).flat();
    const peopleWithoutPhone = people.filter((p) => !p.phoneNormalized);
    const participants: LinkedParticipant[] = [];
    const activities = this.activities ? [...this.activities.activities.values()] : [];
    for (const a of activities) {
      for (const p of a.participants) {
        participants.push({
          id: p.id,
          activityId: a.id,
          personId: p.personId ?? null,
          name: p.name,
          phone: p.phone,
        });
      }
    }
    const participantsWithoutPerson = participants.filter((p) => !p.personId);
    const nameOnlyParticipants = participants.filter((p) => !normalizePhone(p.phone));
    const missingEnd = activities.filter((a) => a.status !== 'draft' && a.status !== 'cancelled' && a.activityDate && !a.endDate);
    const legacy = missingEnd.filter((a) => (a.days || 0) > 0);
    const crossYear = activities.filter((a) => {
      const d = activityDuration({ activityDate: a.activityDate, endDate: a.endDate, days: a.days });
      return d.crossYear;
    });
    const usersWithoutPerson: QualitySample[] = [];
    if (this.identity && typeof this.identity.listAll === 'function') {
      const users = await this.identity.listAll();
      for (const user of users) {
        if (!(await this.getByIdentityUserId(user.id))) {
          usersWithoutPerson.push({ id: user.id, label: user.name, detail: user.email });
        }
      }
    }

    const take = (rows: QualitySample[]) => rows.slice(0, 50);
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
        peopleWithoutPhone: take(peopleWithoutPhone.map((p) => ({ id: p.id, label: p.fullName, detail: p.personReference }))),
        duplicatePhoneCandidates: take(duplicatePeople.map((p) => ({ id: p.id, label: p.fullName, detail: p.phone }))),
        participantsWithoutPerson: take(
          participantsWithoutPerson.map((p) => ({ id: p.id, label: p.name, detail: p.activityId })),
        ),
        identityUsersWithoutPerson: take(usersWithoutPerson),
        legacyDurationRecords: take(legacy.map((a) => ({ id: a.id, label: a.title, detail: 'LEGACY_STORED_DAYS' }))),
        activitiesMissingEndDate: take(missingEnd.map((a) => ({ id: a.id, label: a.title, detail: 'missing_end_date' }))),
        crossYearActivities: take(crossYear.map((a) => ({ id: a.id, label: a.title, detail: 'CROSS_YEAR_REVIEW' }))),
        nameOnlyParticipants: take(nameOnlyParticipants.map((p) => ({ id: p.id, label: p.name, detail: 'name_only' }))),
      },
    };
  }
}
