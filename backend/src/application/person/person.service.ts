import { badRequest, conflict, forbidden, notFound, notImplemented } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';
import { PERSON_PERMISSIONS, hasPersonPermission } from '../../domain/person/permissions.js';
import { decideParticipantIdentity, normalizeEmail, participantLookupKeys } from '../../domain/person/matching.js';
import { normalizePhone } from '../../domain/compliance/identity.js';
import type { PersonIdentityStatus, PersonRecord } from '../../domain/person/types.js';
import type {
  CreatePersonInput,
  IdentityUserLookup,
  ParticipantIdentityInput,
  PersonListFilters,
  PersonRepository,
  PersonResolveResult,
} from './ports.js';

export class PersonService {
  constructor(
    private readonly repo: PersonRepository,
    private readonly identity: IdentityUserLookup,
  ) {}

  private require(actor: Actor, permission: string) {
    if (!hasPersonPermission(actor, permission)) {
      throw forbidden(`Missing permission ${permission}.`);
    }
  }

  async list(actor: Actor, filters: PersonListFilters = {}) {
    this.require(actor, PERSON_PERMISSIONS.SEARCH);
    return this.repo.list(filters);
  }

  async getById(actor: Actor, id: string) {
    this.require(actor, PERSON_PERMISSIONS.VIEW);
    const person = await this.repo.getById(id);
    if (!person) throw notFound('Person not found');
    const events = await this.repo.listEvents(id);
    const identityUser = person.identityUserId ? await this.identity.getById(person.identityUserId) : null;
    return { ...person, events, identityUser };
  }

  async create(actor: Actor, body: CreatePersonInput) {
    this.require(actor, PERSON_PERMISSIONS.CREATE);
    const fullName = String(body.fullName || '').trim();
    if (!fullName) throw badRequest('fullName is required.');
    const phoneNormalized = normalizePhone(body.phone);
    if (phoneNormalized) {
      const existing = await this.repo.findByPhoneNormalized(phoneNormalized);
      if (existing.length === 1) {
        throw conflict('A Person with this phone already exists. Use link instead of creating a duplicate.');
      }
    }
    const person = await this.insertPerson(
      {
        fullName,
        phone: body.phone ?? null,
        email: body.email ?? null,
        organisation: body.organisation ?? null,
        title: body.title ?? null,
        departmentId: body.departmentId ?? null,
        departmentName: body.departmentName ?? null,
        identityStatus: body.identityStatus || (phoneNormalized || body.email ? 'confirmed' : 'unverified'),
        identityUserId: null,
      },
      actor.id,
      'CREATED',
      'Person created',
    );
    return person;
  }

  async update(actor: Actor, id: string, body: Record<string, unknown>) {
    this.require(actor, PERSON_PERMISSIONS.EDIT);
    const current = await this.repo.getById(id);
    if (!current) throw notFound('Person not found');
    const patch: Parameters<PersonRepository['update']>[1] = {};
    if (body.fullName != null) patch.fullName = String(body.fullName).trim();
    if (body.phone !== undefined) patch.phone = body.phone == null ? null : String(body.phone);
    if (body.email !== undefined) patch.email = body.email == null ? null : String(body.email);
    if (body.organisation !== undefined) patch.organisation = body.organisation == null ? null : String(body.organisation);
    if (body.title !== undefined) patch.title = body.title == null ? null : String(body.title);
    if (body.departmentId !== undefined) patch.departmentId = body.departmentId == null ? null : String(body.departmentId);
    if (body.departmentName !== undefined) patch.departmentName = body.departmentName == null ? null : String(body.departmentName);
    if (body.status != null) patch.status = String(body.status);
    if (body.identityStatus != null) patch.identityStatus = String(body.identityStatus) as PersonIdentityStatus;
    const updated = await this.repo.update(id, patch);
    await this.repo.addEvent({
      personId: id,
      action: 'UPDATED',
      summary: 'Person details updated',
      meta: { previous: current, next: updated },
      actorUserId: actor.id,
    });
    return updated;
  }

  async resolveForParticipant(input: ParticipantIdentityInput): Promise<PersonResolveResult> {
    if (input.personId) {
      const existing = await this.repo.getById(input.personId);
      if (existing) return { person: existing, resolution: 'existing' };
    }
    const keys = participantLookupKeys(input.name, input.phone, input.email);
    const phoneMatches = keys.phoneNormalized ? await this.repo.findByPhoneNormalized(keys.phoneNormalized) : [];
    const emailMatches = keys.emailNormalized ? await this.repo.findByEmail(keys.emailNormalized) : [];
    const sameNormalizedNameExists = await this.repo.nameExists(keys.normalizedName);
    const decision = decideParticipantIdentity({
      existingPersonId: input.personId,
      phoneNormalized: keys.phoneNormalized,
      emailNormalized: keys.emailNormalized,
      phoneMatchCount: phoneMatches.length,
      emailMatchCount: emailMatches.length,
      sameNormalizedNameExists,
    });
    if (decision.kind === 'attach_phone') {
      return { person: phoneMatches[0], resolution: 'matched' };
    }
    if (decision.kind === 'attach_email') {
      return { person: emailMatches[0], resolution: 'matched' };
    }
    const created = await this.insertPerson(
      {
        fullName: input.name,
        phone: input.phone || null,
        email: input.email || null,
        organisation: input.organisation || input.title || null,
        title: input.title || null,
        identityStatus: decision.identityStatus,
      },
      null,
      'CREATED',
      `Person created from participant (${decision.resolution})`,
    );
    return { person: created, resolution: decision.resolution };
  }

  async ensureForUser(actor: Actor): Promise<PersonRecord> {
    const existing = await this.repo.getByIdentityUserId(actor.id);
    if (existing) return existing;
    const email = normalizeEmail(actor.email);
    if (email) {
      const emailMatches = await this.repo.findByEmail(email);
      if (emailMatches.length === 1 && !emailMatches[0].identityUserId) {
        return this.applyUserLink(emailMatches[0], actor, null, 'Linked IdentityUser by unique email');
      }
    }
    return this.insertPerson(
      {
        fullName: actor.name || actor.email,
        email: actor.email || null,
        identityStatus: actor.email ? 'confirmed' : 'unverified',
        identityUserId: actor.id,
      },
      actor.id,
      'CREATED',
      'Person created from IdentityUser',
    );
  }

  async linkUser(actor: Actor, personId: string, body: { identityUserId?: string; reason?: string }) {
    this.require(actor, PERSON_PERMISSIONS.LINK);
    const person = await this.repo.getById(personId);
    if (!person) throw notFound('Person not found');
    const identityUserId = String(body.identityUserId || '').trim();
    if (!identityUserId) throw badRequest('identityUserId is required.');
    const user = await this.identity.getById(identityUserId);
    if (!user) throw notFound('IdentityUser not found');
    const already = await this.repo.getByIdentityUserId(identityUserId);
    if (already && already.id === person.id) return person;
    if (person.identityUserId && person.identityUserId !== identityUserId) {
      throw conflict('This Person is already linked to a different IdentityUser.');
    }
    if (already && already.id !== person.id) {
      await this.repo.update(already.id, { identityUserId: null });
      await this.repo.addEvent({
        personId: already.id,
        action: 'UNLINKED_USER',
        summary: 'IdentityUser reassigned to another Person',
        meta: { previousIdentityUserId: identityUserId, newPersonId: person.id, reason: body.reason || null },
        actorUserId: actor.id,
      });
    }
    return this.applyUserLink(person, user, actor.id, body.reason || 'Linked IdentityUser');
  }

  async linkParticipant(actor: Actor, personId: string, body: { participantId?: string; reason?: string }) {
    this.require(actor, PERSON_PERMISSIONS.LINK);
    const person = await this.repo.getById(personId);
    if (!person) throw notFound('Person not found');
    const participantId = String(body.participantId || '').trim();
    if (!participantId) throw badRequest('participantId is required.');
    const participant = await this.repo.getParticipant(participantId);
    if (!participant) throw notFound('Activity participant not found');
    const previousPersonId = participant.personId;
    const updated = await this.repo.setParticipantPerson(participantId, person.id);
    await this.repo.addEvent({
      personId: person.id,
      action: 'LINKED_PARTICIPANT',
      summary: body.reason || 'Linked activity participant',
      meta: {
        participantId,
        previousPersonId,
        newPersonId: person.id,
        participantName: participant.name,
        reason: body.reason || null,
      },
      actorUserId: actor.id,
    });
    if (previousPersonId && previousPersonId !== person.id) {
      await this.repo.addEvent({
        personId: previousPersonId,
        action: 'UNLINKED_PARTICIPANT',
        summary: 'Participant reassigned to another Person',
        meta: { participantId, newPersonId: person.id, reason: body.reason || null },
        actorUserId: actor.id,
      });
    }
    return { person, participant: updated };
  }

  async merge(_actor: Actor) {
    throw notImplemented('Person merge is not implemented in Wave 4.');
  }

  async quality(actor: Actor) {
    this.require(actor, PERSON_PERMISSIONS.VIEW);
    if (!hasPersonPermission(actor, PERSON_PERMISSIONS.LINK) && !hasPersonPermission(actor, PERSON_PERMISSIONS.EDIT)) {
      throw forbidden('Data-quality review is limited to reviewers and administrators.');
    }
    return this.repo.qualitySnapshot();
  }

  private async applyUserLink(
    person: PersonRecord,
    user: { id: string; name: string; email: string; departmentId?: string | null; departmentName?: string | null },
    actorUserId: string | null,
    reason: string,
  ) {
    const previous = { identityUserId: person.identityUserId, identityStatus: person.identityStatus };
    const updated = await this.repo.update(person.id, {
      identityUserId: user.id,
      email: person.email || user.email || null,
      departmentId: person.departmentId || user.departmentId || null,
      departmentName: person.departmentName || user.departmentName || null,
      identityStatus: person.identityStatus === 'unverified' ? 'confirmed' : person.identityStatus,
    });
    await this.repo.addEvent({
      personId: person.id,
      action: 'LINKED_USER',
      summary: reason,
      meta: { previous, next: { identityUserId: user.id, identityStatus: updated.identityStatus } },
      actorUserId,
    });
    return updated;
  }

  private async insertPerson(
    input: CreatePersonInput,
    actorUserId: string | null,
    action: string,
    summary: string,
  ) {
    const personReference = await this.repo.nextReference();
    const person = await this.repo.create({
      ...input,
      personReference,
      phone: input.phone || null,
      email: input.email || null,
    });
    await this.repo.addEvent({
      personId: person.id,
      action,
      summary,
      meta: { personReference, identityStatus: person.identityStatus },
      actorUserId,
    });
    return person;
  }
}

export type PersonDirectory = Pick<PersonService, 'resolveForParticipant' | 'ensureForUser'>;
