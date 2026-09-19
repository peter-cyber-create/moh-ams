import { FLAG_DAY_THRESHOLD, aggregateParticipantsByPerson, flaggedParticipants } from '../../domain/activity/participants.js';
import { PERMISSIONS, type Actor, hasPermission } from '../../domain/activity/permissions.js';
import { forbidden } from '../../domain/activity/errors.js';
import { toActivityDto } from './dto.js';
import type { ActivityRepository } from './ports.js';

export class ActivityReportQueries {
  constructor(private readonly repo: ActivityRepository) {}

  private scope(actor: Actor) {
    if (!hasPermission(actor, PERMISSIONS.VIEW)) throw forbidden('You do not have access to the Activity module.');
    return hasPermission(actor, PERMISSIONS.VIEW_ALL) ? undefined : actor.id;
  }

  async missingReport(actor: Actor) {
    const createdById = this.scope(actor);
    const { data } = await this.repo.list({
      missingReport: true,
      excludeDrafts: true,
      createdById,
      page: 1,
      limit: 100,
    });
    return {
      data: data.map((a) => {
        const dto = toActivityDto(a);
        return {
          id: dto.id,
          activityName: dto.title,
          dept: dto.departmentName,
          invoiceDate: dto.activityDate,
          amt: dto.participants.reduce((sum, p) => sum + (p.amount || 0), 0),
        };
      }),
    };
  }

  async flagged(actor: Actor) {
    this.scope(actor);
    const rows = await this.repo.allParticipants();
    return { data: flaggedParticipants(rows), threshold: FLAG_DAY_THRESHOLD };
  }

  async byDate(actor: Actor) {
    const createdById = this.scope(actor);
    const { data } = await this.repo.list({ excludeDrafts: true, createdById, page: 1, limit: 100, sort: 'activityDate' });
    return { data: data.map(toActivityDto) };
  }

  async byFunding(actor: Actor, funder?: string) {
    const createdById = this.scope(actor);
    const { data } = await this.repo.list({ excludeDrafts: true, createdById, funder, page: 1, limit: 100 });
    return { data: data.map(toActivityDto) };
  }

  async byPerson(actor: Actor, name?: string) {
    this.scope(actor);
    const rows = await this.repo.allParticipants();
    const q = String(name || '').trim().toLowerCase();
    const data = rows
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .map((r, idx) => ({
        id: `${r.activityId}:${idx}`,
        name: r.name,
        title: r.title,
        phone: r.phone,
        activityName: r.activityTitle,
        days: r.days,
        amount: r.amount,
      }));
    return { data };
  }

  async amounts(actor: Actor) {
    this.scope(actor);
    const rows = await this.repo.allParticipants();
    return {
      data: aggregateParticipantsByPerson(rows).map((u) => ({
        name: u.name,
        title: u.title,
        phone: u.phone,
        totalDays: u.totalDays,
        totalAmounts: u.totalAmount,
      })),
    };
  }

  async participantActivity(actor: Actor) {
    this.scope(actor);
    const rows = await this.repo.allParticipants();
    return {
      data: rows.map((r, idx) => ({
        id: `${r.activityId}:${idx}`,
        name: r.name,
        title: r.title,
        phone: r.phone,
        activity: r.activityTitle,
        days: r.days,
        amount: r.amount,
        invoiceDate: r.activityDate,
        vocherno: r.referenceNumber,
        funder: r.funder,
      })),
    };
  }
}
