import { isParticipationEligibleStatus } from '../domain/compliance/participation.js';
import type { MemoryActivityRepository } from './memory-activity.repository.js';
import type { MemoryAccountabilityRepository, MemoryIdentityLookup } from './memory-accountability.repository.js';
import type { MemoryPersonRepository } from './memory-person.repository.js';
import type { ComplianceReadPort, DirectoryPerson, IdentityPerson, ParticipationSourceRow } from '../application/compliance/ports.js';

export class MemoryComplianceReadPort implements ComplianceReadPort {
  constructor(
    private readonly activities: MemoryActivityRepository,
    private readonly accountabilities: MemoryAccountabilityRepository,
    private readonly identity: MemoryIdentityLookup,
    private readonly persons: MemoryPersonRepository,
  ) {}

  async participationRows(year: number): Promise<ParticipationSourceRow[]> {
    const rows = await this.activities.allParticipants();
    return rows
      .filter((r) => isParticipationEligibleStatus(r.activityStatus))
      .filter((r) => !r.activityDate || r.activityDate.getUTCFullYear() === year)
      .map((r) => ({
        personId: r.personId ?? null,
        name: r.name,
        phone: r.phone,
        title: r.title,
        activityId: r.activityId,
        activityTitle: r.activityTitle,
        activityStatus: r.activityStatus,
        activityDate: r.activityDate,
        endDate: r.endDate,
        activityDays: r.activityDays,
        departmentName: r.departmentName,
        referenceNumber: r.referenceNumber,
      }));
  }

  async accountabilityRows() {
    const { data } = await this.accountabilities.list({ page: 1, limit: 1000 });
    return data.map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      status: r.status,
      dueDate: r.dueDate,
      submittedById: r.submittedById,
      personId: r.personId ?? null,
      activityId: r.activityId,
      activityTitle: r.activityTitle,
    }));
  }

  async identityPeople(ids: string[]): Promise<IdentityPerson[]> {
    const out: IdentityPerson[] = [];
    for (const id of ids) {
      const u = await this.identity.getById(id);
      if (u) out.push({ id: u.id, name: u.name, email: u.email, departmentName: null });
    }
    return out;
  }

  async directoryPeople(ids: string[]): Promise<DirectoryPerson[]> {
    const out: DirectoryPerson[] = [];
    for (const id of ids) {
      const p = await this.persons.getById(id);
      if (p) {
        out.push({
          id: p.id,
          personReference: p.personReference,
          fullName: p.fullName,
          phone: p.phone,
          email: p.email,
          organisation: p.organisation,
          title: p.title,
          departmentName: p.departmentName,
          identityStatus: p.identityStatus,
          identityUserId: p.identityUserId,
          phoneNormalized: p.phoneNormalized,
        });
      }
    }
    return out;
  }

  async findPeopleByPhoneNormalized(phoneNormalized: string): Promise<DirectoryPerson[]> {
    if (!phoneNormalized) return [];
    const out: DirectoryPerson[] = [];
    for (const p of this.persons.people.values()) {
      if (p.phoneNormalized === phoneNormalized) {
        out.push({
          id: p.id,
          personReference: p.personReference,
          fullName: p.fullName,
          phone: p.phone,
          email: p.email,
          organisation: p.organisation,
          title: p.title,
          departmentName: p.departmentName,
          identityStatus: p.identityStatus,
          identityUserId: p.identityUserId,
          phoneNormalized: p.phoneNormalized,
        });
      }
    }
    return out;
  }
}
