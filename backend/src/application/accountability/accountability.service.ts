import { badRequest, forbidden, notFound } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';
import { canAccessActivity } from '../../domain/activity/permissions.js';
import { sanitizeLines } from '../../domain/accountability/finance.js';
import {
  ACC_PERMISSIONS,
  canAccessCase,
  canDecideAsReviewer,
  hasAccPermission,
} from '../../domain/accountability/permissions.js';
import {
  canTransitionAccountability,
  defaultDueDate,
  isEditableStatus,
  isOpenStatus,
} from '../../domain/accountability/statuses.js';
import { toAccEventDto, toAccountabilityDto } from './dto.js';
import type {
  AccountabilityRecord,
  AccountabilityRepository,
  ActivityLookup,
  IdentityLookup,
} from './ports.js';
import type { FileStore } from '../activity/ports.js';
import type { PersonDirectory } from '../person/person.service.js';
import type { NotificationService } from '../notification/notification.service.js';
import { NOTIFICATION_TYPES } from '../../domain/notification/types.js';

export class AccountabilityService {
  constructor(
    private readonly repo: AccountabilityRepository,
    private readonly activities: ActivityLookup,
    private readonly files: FileStore,
    private readonly identity: IdentityLookup,
    private readonly persons: PersonDirectory,
    private readonly notifications?: NotificationService,
  ) {}

  private async notify(input: Parameters<NotificationService['notify']>[0]) {
    if (!this.notifications) return;
    try {
      await this.notifications.notify(input);
    } catch {
      // Notifications must not break the case lifecycle.
    }
  }

  private require(actor: Actor, permission: (typeof ACC_PERMISSIONS)[keyof typeof ACC_PERMISSIONS]) {
    if (!hasAccPermission(actor, ACC_PERMISSIONS.VIEW) && !hasAccPermission(actor, permission)) {
      throw forbidden('You do not have access to the Accountability module.');
    }
    if (!hasAccPermission(actor, permission)) {
      throw forbidden(`Missing permission ${permission}.`);
    }
  }

  private async load(actor: Actor, id: string): Promise<AccountabilityRecord> {
    this.require(actor, ACC_PERMISSIONS.VIEW);
    const row = await this.repo.getById(id);
    if (!row) throw notFound('Accountability not found');
    if (!canAccessCase(actor, row)) throw forbidden();
    return row;
  }

  private assertTransition(from: string, to: string) {
    if (!canTransitionAccountability(from, to)) {
      throw badRequest(`Invalid status transition: ${from} -> ${to}`);
    }
  }

  private assertNotClosed(row: AccountabilityRecord) {
    if (row.status === 'closed') throw badRequest('A closed accountability cannot be modified.');
    if (row.status === 'rejected') throw badRequest('A rejected accountability cannot be modified.');
  }

  async list(
    actor: Actor,
    filters: {
      view?: string;
      status?: string;
      search?: string;
      activityId?: string;
      reviewerId?: string;
      department?: string;
      page?: number;
      limit?: number;
      sort?: 'createdAt' | 'dueDate' | 'referenceNumber';
      order?: 'asc' | 'desc';
    },
  ) {
    this.require(actor, ACC_PERMISSIONS.VIEW);
    const result = await this.repo.list({ ...filters, actor });
    return { ...result, data: result.data.map((row) => toAccountabilityDto(row)) };
  }

  async financialTotals(actor: Actor) {
    this.require(actor, ACC_PERMISSIONS.VIEW);
    return this.repo.financialTotals({ actor });
  }

  async getById(actor: Actor, id: string) {
    return toAccountabilityDto(await this.load(actor, id));
  }

  async create(
    actor: Actor,
    body: { activityId?: string; dueDate?: string; lines?: unknown; amountReturned?: number },
  ) {
    this.require(actor, ACC_PERMISSIONS.CREATE);
    const activityId = String(body.activityId || '').trim();
    if (!activityId) throw badRequest('activityId is required.');
    const activity = await this.activities.getById(activityId);
    if (!activity) throw notFound('Activity not found');
    if (!canAccessActivity(actor, activity.createdById) && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) {
      throw forbidden();
    }
    const activityStatus = String(activity.status || '').toLowerCase();
    if (activityStatus === 'draft' || activityStatus === 'cancelled') {
      throw badRequest('Accountability cannot be created for a draft or cancelled activity.');
    }
    const open = await this.repo.findOpenByActivity(activityId);
    if (open) throw badRequest('An open accountability already exists for this activity.');
    let lines: { kind: string; description: string; amount: number }[] = [];
    try {
      lines = sanitizeLines(body.lines);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : 'Invalid financial items');
    }
    const amountReturned = Number(body.amountReturned || 0);
    if (!(amountReturned >= 0)) throw badRequest('amountReturned must be 0 or greater.');
    const dueDate = body.dueDate ? new Date(body.dueDate) : defaultDueDate();
    if (Number.isNaN(dueDate.getTime())) throw badRequest('dueDate is invalid.');
    const ref = await this.repo.nextReference(new Date().getUTCFullYear());
    const person = await this.persons.ensureForUser(actor);
    const created = await this.repo.create({
      referenceNumber: ref,
      activityId,
      status: 'draft',
      amountAdvanced: Number(activity.budgetAmount || 0),
      amountReturned,
      dueDate,
      submittedById: actor.id,
      personId: person.id,
      lines,
    });
    await this.repo.addEvent({
      accountabilityId: created.id,
      action: 'CREATED',
      summary: `Accountability ${created.referenceNumber} created`,
      fromStatus: null,
      toStatus: 'draft',
      meta: { activityId },
      actorUserId: actor.id,
    });
    return toAccountabilityDto((await this.repo.getById(created.id))!);
  }

  async update(actor: Actor, id: string, body: Record<string, unknown>) {
    const row = await this.load(actor, id);
    this.assertNotClosed(row);
    if (body.status != null) {
      throw badRequest('Status cannot be changed with PATCH. Use a named action.');
    }
    this.require(actor, ACC_PERMISSIONS.SUBMIT);
    if (actor.id !== row.submittedById && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) {
      throw forbidden();
    }
    if (!isEditableStatus(row.status)) {
      throw badRequest('This accountability cannot be edited in its current status.');
    }
    if (row.status === 'clarification_requested') {
      throw badRequest('Respond to the clarification instead of editing the case.');
    }
    const patch: Parameters<AccountabilityRepository['update']>[1] = {};
    if (body.amountReturned != null) {
      const amountReturned = Number(body.amountReturned);
      if (!(amountReturned >= 0)) throw badRequest('amountReturned must be 0 or greater.');
      patch.amountReturned = amountReturned;
    }
    if (body.dueDate !== undefined) {
      const dueDate = new Date(String(body.dueDate));
      if (Number.isNaN(dueDate.getTime())) throw badRequest('dueDate is invalid.');
      patch.dueDate = dueDate;
    }
    if (body.lines !== undefined) {
      try {
        patch.lines = sanitizeLines(body.lines);
      } catch (err) {
        throw badRequest(err instanceof Error ? err.message : 'Invalid financial items');
      }
    }
    await this.repo.update(id, patch);
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'UPDATED',
      summary: 'Draft details updated',
      fromStatus: row.status,
      toStatus: row.status,
      meta: {},
      actorUserId: actor.id,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async submit(actor: Actor, id: string) {
    this.require(actor, ACC_PERMISSIONS.SUBMIT);
    const row = await this.load(actor, id);
    if (actor.id !== row.submittedById && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) throw forbidden();
    if (row.status !== 'draft') throw badRequest('Only drafts can be submitted.');
    if (row.lines.length === 0) throw badRequest('Add at least one expenditure line before submitting.');
    if (row.documents.length === 0 && !row.activityHasReport) {
      throw badRequest('Attach supporting documents or submit an activity report before submitting the case.');
    }
    const next = row.reviewerId ? 'under_review' : 'submitted';
    this.assertTransition('draft', 'submitted');
    if (next === 'under_review') this.assertTransition('submitted', 'under_review');
    await this.repo.update(id, { status: next, submittedAt: new Date() });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'SUBMITTED',
      summary: next === 'under_review' ? 'Submitted and placed under review' : 'Accountability submitted',
      fromStatus: 'draft',
      toStatus: next,
      meta: {},
      actorUserId: actor.id,
    });
    if (row.reviewerId) {
      await this.notify({
        recipientUserId: row.reviewerId,
        type: NOTIFICATION_TYPES.ACCOUNTABILITY_SUBMITTED,
        title: 'Accountability submitted',
        message: `${row.referenceNumber} was submitted and is ready for review.`,
        referenceType: 'accountability',
        referenceId: id,
        href: `/accountability/${id}`,
        dedupeKey: `submitted:${id}:${Date.now()}`,
      });
    } else {
      const reviewers = await this.identity.listReviewers().catch(() => [] as Actor[]);
      if (reviewers.length > 0) {
        for (const r of reviewers) {
          await this.notify({
            recipientUserId: r.id,
            type: NOTIFICATION_TYPES.ACCOUNTABILITY_SUBMITTED,
            title: 'Accountability submitted',
            message: `${row.referenceNumber} was submitted and awaits reviewer assignment.`,
            referenceType: 'accountability',
            referenceId: id,
            href: `/accountability/${id}`,
            dedupeKey: `submitted:${id}:${r.id}`,
          });
        }
      } else {
        await this.notify({
          recipientUserId: row.submittedById,
          type: NOTIFICATION_TYPES.ACCOUNTABILITY_SUBMITTED,
          title: 'Accountability submitted',
          message: `${row.referenceNumber} was submitted. A reviewer can now be assigned.`,
          referenceType: 'accountability',
          referenceId: id,
          href: `/accountability/${id}`,
          dedupeKey: `submitted:${id}`,
        });
      }
    }
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async assign(actor: Actor, id: string, body: { reviewerId?: string }) {
    this.require(actor, ACC_PERMISSIONS.ASSIGN);
    const row = await this.load(actor, id);
    this.assertNotClosed(row);
    const reviewerId = String(body.reviewerId || '').trim();
    if (!reviewerId) throw badRequest('reviewerId is required.');
    const reviewer = await this.identity.getById(reviewerId);
    if (!reviewer) throw badRequest('Reviewer was not found.');
    if (!hasAccPermission(reviewer, ACC_PERMISSIONS.REVIEW)) {
      throw badRequest('The selected user cannot review accountabilities.');
    }
    const assignable = ['submitted', 'resubmitted', 'under_review', 'draft'];
    if (!assignable.includes(row.status)) {
      throw badRequest('A reviewer cannot be assigned in this status.');
    }
    let next = row.status;
    if (row.status === 'submitted' || row.status === 'resubmitted') {
      this.assertTransition(row.status, 'under_review');
      next = 'under_review';
    }
    await this.repo.update(id, {
      reviewerId,
      assignedAt: new Date(),
      assignedById: actor.id,
      status: next,
    });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'REVIEWER_ASSIGNED',
      summary: 'Reviewer assigned',
      fromStatus: row.status,
      toStatus: next,
      meta: { reviewerId },
      actorUserId: actor.id,
    });
    await this.notify({
      recipientUserId: reviewerId,
      type: NOTIFICATION_TYPES.ACCOUNTABILITY_ASSIGNED,
      title: 'Accountability assigned to you',
      message: `${row.referenceNumber} was assigned for your review.`,
      referenceType: 'accountability',
      referenceId: id,
      href: `/accountability/${id}`,
      dedupeKey: `assigned:${id}:${reviewerId}`,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async returnCase(actor: Actor, id: string, body: { reason?: string }) {
    this.require(actor, ACC_PERMISSIONS.RETURN);
    const row = await this.load(actor, id);
    if (!canDecideAsReviewer(actor, row.reviewerId)) throw forbidden('This case is not assigned to you.');
    if (row.status !== 'under_review') throw badRequest('Only a case under review can be returned.');
    const reason = String(body.reason || '').trim();
    if (!reason) throw badRequest('A return reason is required.');
    this.assertTransition('under_review', 'returned');
    const now = new Date();
    await this.repo.update(id, { status: 'returned', returnReason: reason, reviewedAt: now });
    await this.repo.addComment({ accountabilityId: id, kind: 'return', body: reason, actorUserId: actor.id });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'RETURNED',
      summary: 'Returned for correction',
      fromStatus: 'under_review',
      toStatus: 'returned',
      meta: { reason },
      actorUserId: actor.id,
    });
    await this.notify({
      recipientUserId: row.submittedById,
      type: NOTIFICATION_TYPES.ACCOUNTABILITY_RETURNED,
      title: 'Accountability returned',
      message: `${row.referenceNumber} was returned. Reason: ${reason}`,
      referenceType: 'accountability',
      referenceId: id,
      href: `/accountability/${id}`,
      dedupeKey: `returned:${id}:${now.toISOString()}`,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async requestClarification(actor: Actor, id: string, body: { question?: string }) {
    this.require(actor, ACC_PERMISSIONS.CLARIFY);
    const row = await this.load(actor, id);
    if (!canDecideAsReviewer(actor, row.reviewerId)) throw forbidden('This case is not assigned to you.');
    if (row.status !== 'under_review') throw badRequest('Clarification can only be requested while under review.');
    const question = String(body.question || '').trim();
    if (!question) throw badRequest('A clarification question is required.');
    this.assertTransition('under_review', 'clarification_requested');
    await this.repo.addClarification({ accountabilityId: id, question, requestedById: actor.id });
    await this.repo.update(id, { status: 'clarification_requested', reviewedAt: new Date() });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'CLARIFICATION_REQUESTED',
      summary: 'Clarification requested',
      fromStatus: 'under_review',
      toStatus: 'clarification_requested',
      meta: { question },
      actorUserId: actor.id,
    });
    await this.notify({
      recipientUserId: row.submittedById,
      type: NOTIFICATION_TYPES.CLARIFICATION_REQUESTED,
      title: 'Clarification requested',
      message: `${row.referenceNumber}: ${question}`,
      referenceType: 'accountability',
      referenceId: id,
      href: `/accountability/${id}`,
      dedupeKey: `clarify:${id}:${Date.now()}`,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async respondClarification(actor: Actor, id: string, clarificationId: string, body: { response?: string }) {
    this.require(actor, ACC_PERMISSIONS.SUBMIT);
    const row = await this.load(actor, id);
    if (actor.id !== row.submittedById && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) throw forbidden();
    if (row.status !== 'clarification_requested') {
      throw badRequest('There is no open clarification to respond to.');
    }
    const response = String(body.response || '').trim();
    if (!response) throw badRequest('A clarification response is required.');
    const item = row.clarifications.find((c) => c.id === clarificationId);
    if (!item) throw notFound('Clarification not found');
    if (item.status !== 'open') throw badRequest('This clarification has already been answered.');
    this.assertTransition('clarification_requested', 'under_review');
    await this.repo.respondClarification(id, clarificationId, response, actor.id);
    await this.repo.update(id, { status: 'under_review' });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'CLARIFICATION_RESPONDED',
      summary: 'Clarification answered',
      fromStatus: 'clarification_requested',
      toStatus: 'under_review',
      meta: { clarificationId },
      actorUserId: actor.id,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async resubmit(actor: Actor, id: string) {
    this.require(actor, ACC_PERMISSIONS.SUBMIT);
    const row = await this.load(actor, id);
    if (actor.id !== row.submittedById && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) throw forbidden();
    if (row.status !== 'returned') throw badRequest('Only a returned accountability can be resubmitted.');
    if (row.lines.length === 0) throw badRequest('Add at least one expenditure line before resubmitting.');
    this.assertTransition('returned', 'resubmitted');
    let next: 'resubmitted' | 'under_review' = 'resubmitted';
    if (row.reviewerId) {
      this.assertTransition('resubmitted', 'under_review');
      next = 'under_review';
    }
    await this.repo.update(id, { status: next, submittedAt: new Date() });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'RESUBMITTED',
      summary: next === 'under_review' ? 'Resubmitted and returned to review' : 'Accountability resubmitted',
      fromStatus: 'returned',
      toStatus: next,
      meta: {},
      actorUserId: actor.id,
    });
    if (row.reviewerId) {
      await this.notify({
        recipientUserId: row.reviewerId,
        type: NOTIFICATION_TYPES.ACCOUNTABILITY_RESUBMITTED,
        title: 'Accountability resubmitted',
        message: `${row.referenceNumber} was resubmitted and needs review.`,
        referenceType: 'accountability',
        referenceId: id,
        href: `/accountability/${id}`,
        dedupeKey: `resubmitted:${id}:${Date.now()}`,
      });
    }
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async approve(actor: Actor, id: string, body: { note?: string } = {}) {
    this.require(actor, ACC_PERMISSIONS.APPROVE);
    const row = await this.load(actor, id);
    if (!canDecideAsReviewer(actor, row.reviewerId)) throw forbidden('This case is not assigned to you.');
    if (row.status !== 'under_review') throw badRequest('Only a case under review can be approved.');
    this.assertTransition('under_review', 'approved');
    const now = new Date();
    await this.repo.update(id, { status: 'approved', approvedAt: now, approvedById: actor.id, reviewedAt: now });
    const note = String(body.note || '').trim();
    if (note) await this.repo.addComment({ accountabilityId: id, kind: 'approval', body: note, actorUserId: actor.id });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'APPROVED',
      summary: 'Accountability approved',
      fromStatus: 'under_review',
      toStatus: 'approved',
      meta: note ? { note } : {},
      actorUserId: actor.id,
    });
    await this.notify({
      recipientUserId: row.submittedById,
      type: NOTIFICATION_TYPES.ACCOUNTABILITY_APPROVED,
      title: 'Accountability approved',
      message: `${row.referenceNumber} was approved.`,
      referenceType: 'accountability',
      referenceId: id,
      href: `/accountability/${id}`,
      dedupeKey: `approved:${id}`,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async reject(actor: Actor, id: string, body: { reason?: string }) {
    this.require(actor, ACC_PERMISSIONS.REJECT);
    const row = await this.load(actor, id);
    if (!canDecideAsReviewer(actor, row.reviewerId)) throw forbidden('This case is not assigned to you.');
    if (row.status !== 'under_review') throw badRequest('Only a case under review can be rejected.');
    const reason = String(body.reason || '').trim();
    if (!reason) throw badRequest('A rejection reason is required.');
    this.assertTransition('under_review', 'rejected');
    const now = new Date();
    await this.repo.update(id, {
      status: 'rejected',
      rejectedAt: now,
      rejectedById: actor.id,
      rejectionReason: reason,
      reviewedAt: now,
    });
    await this.repo.addComment({ accountabilityId: id, kind: 'rejection', body: reason, actorUserId: actor.id });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'REJECTED',
      summary: 'Accountability rejected',
      fromStatus: 'under_review',
      toStatus: 'rejected',
      meta: { reason },
      actorUserId: actor.id,
    });
    await this.notify({
      recipientUserId: row.submittedById,
      type: NOTIFICATION_TYPES.ACCOUNTABILITY_REJECTED,
      title: 'Accountability rejected',
      message: `${row.referenceNumber} was rejected. Reason: ${reason}`,
      referenceType: 'accountability',
      referenceId: id,
      href: `/accountability/${id}`,
      dedupeKey: `rejected:${id}`,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async close(actor: Actor, id: string, body: { reason?: string } = {}) {
    this.require(actor, ACC_PERMISSIONS.CLOSE);
    const row = await this.load(actor, id);
    if (!canDecideAsReviewer(actor, row.reviewerId) && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) {
      throw forbidden('This case is not assigned to you.');
    }
    if (row.status !== 'approved') throw badRequest('Only an approved accountability can be closed.');
    this.assertTransition('approved', 'closed');
    const reason = String(body.reason || '').trim() || 'Closed after approval';
    const now = new Date();
    await this.repo.update(id, { status: 'closed', closedAt: now, closedById: actor.id, closureReason: reason });
    await this.repo.addComment({ accountabilityId: id, kind: 'closure', body: reason, actorUserId: actor.id });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'CLOSED',
      summary: 'Accountability closed',
      fromStatus: 'approved',
      toStatus: 'closed',
      meta: {
        reason,
        amountAdvanced: row.amountAdvanced,
        amountReturned: row.amountReturned,
        lineCount: row.lines.length,
      },
      actorUserId: actor.id,
    });
    await this.notify({
      recipientUserId: row.submittedById,
      type: NOTIFICATION_TYPES.ACCOUNTABILITY_CLOSED,
      title: 'Accountability closed',
      message: `${row.referenceNumber} was closed.`,
      referenceType: 'accountability',
      referenceId: id,
      href: `/accountability/${id}`,
      dedupeKey: `closed:${id}`,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async timeline(actor: Actor, id: string) {
    await this.load(actor, id);
    const events = await this.repo.timeline(id);
    return { data: events.map(toAccEventDto) };
  }

  async documents(actor: Actor, id: string) {
    const row = await this.load(actor, id);
    return { data: row.documents };
  }

  async addDocument(
    actor: Actor,
    id: string,
    file: { originalname: string; mimetype?: string; size?: number; buffer?: Buffer; path?: string },
  ) {
    this.require(actor, ACC_PERMISSIONS.SUBMIT);
    const row = await this.load(actor, id);
    this.assertNotClosed(row);
    if (actor.id !== row.submittedById && !hasAccPermission(actor, ACC_PERMISSIONS.MANAGE)) throw forbidden();
    if (!isOpenStatus(row.status) || row.status === 'approved') {
      throw badRequest('Documents cannot be added in this status.');
    }
    if (row.status === 'under_review' || row.status === 'submitted' || row.status === 'resubmitted') {
      throw badRequest('Documents cannot be added while the case is in review.');
    }
    const saved = await this.files.save(file);
    await this.repo.addDocument(id, {
      kind: 'supporting',
      storedPath: saved.storedPath,
      originalName: saved.originalName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      uploadedById: actor.id,
    });
    await this.repo.addEvent({
      accountabilityId: id,
      action: 'DOCUMENT_ADDED',
      summary: 'Supporting document added',
      fromStatus: row.status,
      toStatus: row.status,
      meta: { storedPath: saved.storedPath },
      actorUserId: actor.id,
    });
    return toAccountabilityDto((await this.repo.getById(id))!);
  }

  async listReviewers(actor: Actor) {
    this.require(actor, ACC_PERMISSIONS.ASSIGN);
    const users = await this.identity.listReviewers();
    return {
      data: users.map((u) => ({ id: u.id, name: u.name, email: u.email, roleName: u.roleName })),
    };
  }
}
