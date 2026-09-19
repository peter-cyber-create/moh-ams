import { prisma } from './prisma.js';
import type { ComplianceReadPort, DirectoryPerson, IdentityPerson, ParticipationSourceRow } from '../application/compliance/ports.js';

export class PrismaComplianceReadPort implements ComplianceReadPort {
  async participationRows(year: number): Promise<ParticipationSourceRow[]> {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const rows = await prisma.activityParticipant.findMany({
      where: {
        activity: {
          status: { notIn: ['draft', 'cancelled'] },
          activityDate: { gte: start, lt: end },
        },
      },
      include: {
        activity: {
          select: {
            title: true,
            status: true,
            activityDate: true,
            endDate: true,
            days: true,
            departmentName: true,
            referenceNumber: true,
          },
        },
      },
    });
    return rows.map((p) => ({
      personId: p.personId,
      name: p.name,
      phone: p.phone,
      title: p.title,
      activityId: p.activityId,
      activityTitle: p.activity.title,
      activityStatus: p.activity.status,
      activityDate: p.activity.activityDate,
      endDate: p.activity.endDate,
      activityDays: p.activity.days,
      departmentName: p.activity.departmentName,
      referenceNumber: p.activity.referenceNumber,
    }));
  }

  async accountabilityRows() {
    const rows = await prisma.accountability.findMany({
      where: { status: { not: 'draft' } },
      include: { activity: { select: { title: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      status: r.status,
      dueDate: r.dueDate,
      submittedById: r.submittedById,
      personId: r.personId,
      activityId: r.activityId,
      activityTitle: r.activity.title,
    }));
  }

  async identityPeople(ids: string[]): Promise<IdentityPerson[]> {
    if (!ids.length) return [];
    const users = await prisma.identityUser.findMany({ where: { id: { in: ids } } });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      departmentName: u.departmentName,
    }));
  }

  async directoryPeople(ids: string[]): Promise<DirectoryPerson[]> {
    if (!ids.length) return [];
    const rows = await prisma.person.findMany({ where: { id: { in: ids } } });
    return rows.map((p) => ({
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
    }));
  }

  async findPeopleByPhoneNormalized(phoneNormalized: string): Promise<DirectoryPerson[]> {
    if (!phoneNormalized) return [];
    const rows = await prisma.person.findMany({ where: { phoneNormalized } });
    return rows.map((p) => ({
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
    }));
  }
}
