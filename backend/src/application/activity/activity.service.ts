import { badRequest, forbidden, notFound } from '../../domain/activity/errors.js';
import { classifyParticipantImport, importSummary, rowFromSpreadsheet } from '../../domain/activity/import-participants.js';
import { sanitizeParticipants, type ParticipantRecord } from '../../domain/activity/participants.js';
import {
  Actor,
  PERMISSIONS,
  canAccessActivity,
  hasPermission,
} from '../../domain/activity/permissions.js';
import {
  canReceiveReport,
  canTransition,
  isActivityStatus,
  isEditableStatus,
} from '../../domain/activity/statuses.js';
import { participantIdentity } from '../../domain/compliance/identity.js';
import { activityDuration } from '../../domain/compliance/participation.js';
import { toActivityDto, toEventDto } from './dto.js';
import type { ActivityRepository, FileStore, ListFilters, UpdateActivityInput } from './ports.js';
import type { PersonDirectory } from '../person/person.service.js';
import type { PersonResolution } from '../../domain/person/matching.js';

function parseDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function stampParticipants(participants: ParticipantRecord[], durationDays: number | null): ParticipantRecord[] {
  if (durationDays == null) return participants;
  return participants.map((p) => ({ ...p, days: durationDays }));
}

export class ActivityService {
  constructor(
    private readonly repo: ActivityRepository,
    private readonly files: FileStore,
    private readonly persons: PersonDirectory,
  ) {}

  private require(actor: Actor, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
    if (!hasPermission(actor, permission) && !hasPermission(actor, PERMISSIONS.VIEW)) {
      throw forbidden('You do not have access to the Activity module.');
    }
    if (!hasPermission(actor, permission)) {
      throw forbidden(`Missing permission ${permission}.`);
    }
  }

  async list(actor: Actor, filters: ListFilters) {
    this.require(actor, PERMISSIONS.VIEW);
    const scoped: ListFilters = { ...filters, excludeDrafts: filters.status === 'draft' ? false : filters.excludeDrafts !== false };
    if (filters.status === 'draft') {
      scoped.createdById = actor.id;
      scoped.excludeDrafts = false;
    } else if (!hasPermission(actor, PERMISSIONS.VIEW_ALL)) {
      scoped.createdById = actor.id;
    }
    const result = await this.repo.list(scoped);
    return { ...result, data: result.data.map(toActivityDto) };
  }

  async countStats(actor: Actor, year: number, now = new Date()) {
    this.require(actor, PERMISSIONS.VIEW);
    const createdById = !hasPermission(actor, PERMISSIONS.VIEW_ALL) ? actor.id : undefined;
    return this.repo.countStats({ year, month: now.getUTCMonth(), createdById, now });
  }

  async getById(actor: Actor, id: string) {
    this.require(actor, PERMISSIONS.VIEW);
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById)) throw forbidden();
    return toActivityDto(activity);
  }

  async create(
    actor: Actor,
    body: {
      title?: string;
      description?: string;
      requestedBy?: string;
      location?: string;
      departmentName?: string;
      departmentId?: string;
      activityDate?: string;
      endDate?: string;
      invoiceDate?: string;
      amount?: number;
      budgetAmount?: number;
      funder?: string;
      voucherNumber?: string;
      referenceNumber?: string;
      activityType?: string;
      days?: number;
      status?: string;
      participants?: unknown;
    },
  ) {
    this.require(actor, PERMISSIONS.CREATE);
    const status = (body.status || 'planned').toLowerCase();
    if (status !== 'draft' && status !== 'planned') {
      throw badRequest('New activities must be draft or planned.');
    }
    if (status === 'planned') this.require(actor, PERMISSIONS.SUBMIT);
    let participants: ParticipantRecord[] = [];
    try {
      participants = sanitizeParticipants(body.participants);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : 'Invalid participants');
    }
    const title = String(body.title || '').trim() || (status === 'draft' ? 'Untitled draft' : '');
    if (!title) throw badRequest('Title is required.');
    const amount = Number(body.budgetAmount ?? body.amount ?? 0);
    if (status === 'planned' && !(amount > 0)) throw badRequest('Amount must be greater than 0.');
    const dateRaw = body.activityDate || body.invoiceDate;
    const activityDate = dateRaw ? new Date(dateRaw) : null;
    const endDate = parseDate(body.endDate);
    const duration = activityDuration({ activityDate, endDate, days: body.days ?? null });
    if (duration.issues.includes('end_before_start')) throw badRequest('End date cannot be before the start date.');
    const participantsStamped = stampParticipants(participants, duration.days);
    const resolved = await this.resolveParticipants(participantsStamped);
    const created = await this.repo.create({
      title,
      description: body.description ?? null,
      requestedBy: body.requestedBy ?? null,
      location: body.location ?? null,
      departmentName: body.departmentName ?? null,
      departmentId: body.departmentId ?? null,
      activityDate,
      endDate,
      budgetAmount: amount || 0,
      funder: body.funder ?? null,
      referenceNumber: body.referenceNumber ?? body.voucherNumber ?? null,
      activityType: body.activityType ?? null,
      days: duration.days,
      status,
      createdById: actor.id,
      participants: resolved.rows,
    });
    await this.repo.addEvent({
      activityId: created.id,
      action: 'CREATED',
      summary: status === 'draft' ? 'Draft saved' : 'Activity created',
      fromStatus: null,
      toStatus: status,
      meta: { participantCount: participants.length },
      actorUserId: actor.id,
    });
    return toActivityDto((await this.repo.getById(created.id))!);
  }

  async update(actor: Actor, id: string, body: Record<string, unknown>) {
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById) && !hasPermission(actor, PERMISSIONS.MANAGE)) {
      throw forbidden();
    }

    const nextStatus = body.status != null ? String(body.status).toLowerCase() : undefined;
    if (nextStatus && nextStatus !== activity.status) {
      if (!isActivityStatus(nextStatus)) throw badRequest(`Invalid status "${nextStatus}"`);
      if (!canTransition(activity.status, nextStatus)) {
        throw badRequest(`Invalid status transition: ${activity.status} -> ${nextStatus}`);
      }
      if (nextStatus === 'closed') this.require(actor, PERMISSIONS.CLOSE);
      else if (nextStatus === 'cancelled') this.require(actor, PERMISSIONS.CANCEL);
      else this.require(actor, PERMISSIONS.EDIT);
    } else {
      this.require(actor, PERMISSIONS.EDIT);
      if (!isEditableStatus(activity.status) && !hasPermission(actor, PERMISSIONS.MANAGE)) {
        throw badRequest('This activity cannot be edited in its current status.');
      }
    }

    const patch: UpdateActivityInput = {};
    if (body.title != null) patch.title = String(body.title);
    if (body.description !== undefined) patch.description = body.description as string;
    if (body.requestedBy !== undefined) patch.requestedBy = body.requestedBy as string;
    if (body.location !== undefined) patch.location = body.location as string;
    if (body.departmentName !== undefined) patch.departmentName = body.departmentName as string;
    if (body.funder !== undefined) patch.funder = body.funder as string;
    if (body.voucherNumber !== undefined || body.referenceNumber !== undefined) {
      patch.referenceNumber = String(body.referenceNumber ?? body.voucherNumber ?? '') || null;
    }
    if (body.amount != null || body.budgetAmount != null) {
      patch.budgetAmount = Number(body.budgetAmount ?? body.amount);
    }
    if (body.activityDate !== undefined || body.invoiceDate !== undefined) {
      const raw = (body.activityDate ?? body.invoiceDate) as string | null;
      patch.activityDate = raw ? new Date(raw) : null;
    }
    if (body.endDate !== undefined) {
      patch.endDate = parseDate(body.endDate);
    }
    const nextStart = patch.activityDate !== undefined ? patch.activityDate : activity.activityDate;
    const nextEnd = patch.endDate !== undefined ? patch.endDate : activity.endDate;
    const duration = activityDuration({
      activityDate: nextStart ?? null,
      endDate: nextEnd ?? null,
      days: patch.days !== undefined ? patch.days : activity.days,
    });
    if (duration.issues.includes('end_before_start')) throw badRequest('End date cannot be before the start date.');
    if (body.endDate !== undefined || body.activityDate !== undefined || body.invoiceDate !== undefined) {
      patch.days = duration.days;
    }
    if (nextStatus) patch.status = nextStatus;
    if (body.participants !== undefined) {
      try {
        patch.participants = body.participants == null ? [] : sanitizeParticipants(body.participants);
      } catch (err) {
        throw badRequest(err instanceof Error ? err.message : 'Invalid participants');
      }
    }
    if (patch.participants) {
      const resolved = await this.resolveParticipants(stampParticipants(patch.participants, duration.days));
      patch.participants = resolved.rows;
    } else if (
      patch.days !== undefined &&
      duration.days != null &&
      activity.participants.length > 0 &&
      (body.endDate !== undefined || body.activityDate !== undefined || body.invoiceDate !== undefined)
    ) {
      patch.participants = stampParticipants(
        activity.participants.map((p) => ({
          name: p.name,
          title: p.title || '',
          phone: p.phone || '',
          amount: p.amount,
          days: p.days,
          personId: p.personId ?? null,
        })),
        duration.days,
      );
    }

    const updated = await this.repo.update(id, patch);
    await this.repo.addEvent({
      activityId: id,
      action: nextStatus && nextStatus !== activity.status ? 'STATUS_CHANGED' : 'UPDATED',
      summary:
        nextStatus && nextStatus !== activity.status
          ? `Status changed from ${activity.status} to ${nextStatus}`
          : 'Activity details updated',
      fromStatus: activity.status,
      toStatus: updated.status,
      meta: {},
      actorUserId: actor.id,
    });
    return toActivityDto((await this.repo.getById(id))!);
  }

  async submitDraft(actor: Actor, id: string) {
    this.require(actor, PERMISSIONS.SUBMIT);
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById)) throw forbidden();
    if (activity.status !== 'draft') throw badRequest('Only drafts can be submitted.');
    if (!activity.title.trim() || activity.title === 'Untitled draft') throw badRequest('Title is required.');
    if (!(activity.budgetAmount > 0)) throw badRequest('Amount must be greater than 0.');
    await this.repo.update(id, { status: 'planned' });
    await this.repo.addEvent({
      activityId: id,
      action: 'SUBMITTED',
      summary: 'Draft submitted as planned',
      fromStatus: 'draft',
      toStatus: 'planned',
      meta: {},
      actorUserId: actor.id,
    });
    return toActivityDto((await this.repo.getById(id))!);
  }

  async discardDraft(actor: Actor, id: string) {
    this.require(actor, PERMISSIONS.CREATE);
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById)) throw forbidden();
    if (activity.status !== 'draft') throw badRequest('Only drafts can be discarded.');
    await this.repo.addEvent({
      activityId: id,
      action: 'DISCARDED',
      summary: 'Draft discarded',
      fromStatus: 'draft',
      toStatus: null,
      meta: {},
      actorUserId: actor.id,
    });
    await this.repo.delete(id);
  }

  async timeline(actor: Actor, id: string) {
    this.require(actor, PERMISSIONS.VIEW);
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById)) throw forbidden();
    const events = await this.repo.timeline(id);
    return { data: events.map(toEventDto) };
  }

  async replaceParticipants(actor: Actor, id: string, input: unknown) {
    this.require(actor, PERMISSIONS.EDIT);
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById)) throw forbidden();
    if (!isEditableStatus(activity.status)) throw badRequest('Participants cannot be changed in this status.');
    let participants: ParticipantRecord[];
    try {
      participants = sanitizeParticipants(input);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : 'Invalid participants');
    }
    const duration = activityDuration({
      activityDate: activity.activityDate,
      endDate: activity.endDate,
      days: activity.days,
    });
    const resolved = await this.resolveParticipants(stampParticipants(participants, duration.days));
    await this.repo.replaceParticipants(id, resolved.rows);
    await this.repo.addEvent({
      activityId: id,
      action: 'UPDATED',
      summary: 'Participants replaced',
      fromStatus: activity.status,
      toStatus: activity.status,
      meta: { participantCount: participants.length },
      actorUserId: actor.id,
    });
    return toActivityDto((await this.repo.getById(id))!);
  }

  async listParticipants(actor: Actor, id: string) {
    const dto = await this.getById(actor, id);
    return { data: dto.participants };
  }

  async importSpreadsheet(
    actor: Actor,
    rawRows: Record<string, unknown>[],
    activityId?: string,
  ) {
    this.require(actor, PERMISSIONS.CREATE);
    const emptyIdentity = {
      matchedExistingPerson: 0,
      newPerson: 0,
      ambiguousIdentity: 0,
      needsReview: 0,
    };
    if (!rawRows.length) {
      const empty = classifyParticipantImport([], []);
      return { ...importSummary(empty), ...emptyIdentity };
    }
    const headerKeys = Object.keys(rawRows[0] || {});
    const classified = classifyParticipantImport(rawRows.map(rowFromSpreadsheet), headerKeys);
    const summary = importSummary(classified);
    if (!activityId) return { ...summary, ...emptyIdentity };
    const activity = await this.repo.getById(activityId);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById) && !hasPermission(actor, PERMISSIONS.MANAGE)) {
      throw forbidden();
    }
    if (!isEditableStatus(activity.status) && !hasPermission(actor, PERMISSIONS.MANAGE)) {
      throw badRequest('Participants cannot be imported in this status.');
    }
    const existingKeys = new Set(
      activity.participants.map((p) => participantIdentity(p.name, p.phone).key),
    );
    const toAdd = [];
    const extraRejected = [...summary.reasons];
    for (const row of classified.valid) {
      const key = participantIdentity(row.name, row.phone).key;
      if (existingKeys.has(key)) {
        extraRejected.push({ row: 0, reason: 'Already on this activity.', name: row.name });
        continue;
      }
      existingKeys.add(key);
      toAdd.push(row);
    }
    const merged = [
      ...activity.participants.map((p) => ({
        name: p.name,
        title: p.title || '',
        phone: p.phone || '',
        amount: p.amount,
        days: p.days,
        personId: p.personId ?? null,
      })),
      ...toAdd,
    ];
    const duration = activityDuration({
      activityDate: activity.activityDate,
      endDate: activity.endDate,
      days: activity.days,
    });
    const resolved = await this.resolveParticipants(stampParticipants(merged, duration.days));
    const identityStats = this.identityStats(resolved.resolutions.slice(activity.participants.length));
    await this.repo.replaceParticipants(activityId, resolved.rows);
    await this.repo.addEvent({
      activityId,
      action: 'UPDATED',
      summary: `Imported ${toAdd.length} participants`,
      fromStatus: activity.status,
      toStatus: activity.status,
      meta: { imported: toAdd.length, ...identityStats },
      actorUserId: actor.id,
    });
    return {
      ...summary,
      imported: toAdd.length,
      rejected: extraRejected.length,
      reasons: extraRejected,
      activityId,
      ...identityStats,
    };
  }

  async submitReport(
    actor: Actor,
    id: string,
    file: { originalname: string; mimetype?: string; size?: number; buffer?: Buffer; path?: string },
  ) {
    this.require(actor, PERMISSIONS.REPORT);
    const activity = await this.repo.getById(id);
    if (!activity) throw notFound();
    if (!canAccessActivity(actor, activity.createdById) && !hasPermission(actor, PERMISSIONS.VIEW_ALL)) {
      throw forbidden();
    }
    if (!canReceiveReport(activity.status)) {
      throw badRequest('Cannot upload a report for a draft, closed, or cancelled activity.');
    }
    const saved = await this.files.save(file);
    await this.repo.addDocument(id, {
      kind: 'activity_report',
      storedPath: saved.storedPath,
      originalName: saved.originalName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      uploadedById: actor.id,
    });
    await this.repo.update(id, { status: 'report_submitted' });
    await this.repo.addEvent({
      activityId: id,
      action: 'REPORT_UPLOADED',
      summary: 'Activity report uploaded',
      fromStatus: activity.status,
      toStatus: 'report_submitted',
      meta: { storedPath: saved.storedPath },
      actorUserId: actor.id,
    });
    return toActivityDto((await this.repo.getById(id))!);
  }

  private async resolveParticipants(rows: ParticipantRecord[]) {
    const resolved: ParticipantRecord[] = [];
    const resolutions: PersonResolution[] = [];
    for (const row of rows) {
      const result = await this.persons.resolveForParticipant({
        name: row.name,
        phone: row.phone,
        title: row.title,
        organisation: row.title,
        personId: row.personId,
      });
      resolved.push({ ...row, personId: result.person.id });
      resolutions.push(result.resolution);
    }
    return { rows: resolved, resolutions };
  }

  private identityStats(resolutions: PersonResolution[]) {
    return {
      matchedExistingPerson: resolutions.filter((r) => r === 'matched' || r === 'existing').length,
      newPerson: resolutions.filter((r) => r === 'new').length,
      ambiguousIdentity: resolutions.filter((r) => r === 'ambiguous').length,
      needsReview: resolutions.filter((r) => r === 'needs_review').length,
    };
  }
}
