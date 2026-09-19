import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityService } from '../activity/activity.service.js';
import { AccountabilityService } from '../accountability/accountability.service.js';
import { MemoryActivityRepository, MemoryFileStore } from '../../infrastructure/memory-activity.repository.js';
import {
  MemoryAccountabilityRepository,
  MemoryIdentityLookup,
} from '../../infrastructure/memory-accountability.repository.js';
import { MemoryPersonRepository } from '../../infrastructure/memory-person.repository.js';
import { PersonService } from './person.service.js';
import { DomainError } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };
const reviewer: Actor = { id: 'u3', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };
const admin: Actor = { id: 'ad', email: 'ad@x', name: 'Admin', module: 'Admin', roleName: 'Admin', isActive: true };
const ict: Actor = { id: 'u2', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };
const personA: Actor = { id: 'pa', email: 'a@x', name: 'Person A', module: 'Finance', roleName: 'User', isActive: true };

function setup() {
  const activities = new MemoryActivityRepository();
  const files = new MemoryFileStore();
  const accRepo = new MemoryAccountabilityRepository(activities);
  const identity = new MemoryIdentityLookup([officer, reviewer, admin, ict, personA]);
  const persons = new MemoryPersonRepository(activities, accRepo, identity);
  const personService = new PersonService(persons, identity);
  const activityService = new ActivityService(activities, files, personService);
  const accService = new AccountabilityService(accRepo, activities, files, identity, personService);
  return { activities, personService, activityService, accService, persons };
}

test('same name different phones stay two people', async () => {
  const { activityService, personService } = setup();
  await activityService.create(officer, {
    title: 'Trip',
    amount: 10,
    status: 'planned',
    participants: [
      { name: 'John Doe', phone: '0700111111' },
      { name: 'John Doe', phone: '0700222222' },
    ],
  });
  const listed = await personService.list(reviewer, { search: 'John Doe', limit: 50 });
  assert.equal(listed.total, 2);
});

test('same person with differently formatted phone is one Person', async () => {
  const { activityService, personService } = setup();
  const first = await activityService.create(officer, {
    title: 'A',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Jane', phone: '0700111111' }],
  });
  const second = await activityService.create(officer, {
    title: 'B',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Jane', phone: '+256700111111' }],
  });
  assert.equal(first.participants[0].personId, second.participants[0].personId);
  const listed = await personService.list(reviewer, { phone: '0700111111' });
  assert.equal(listed.total, 1);
});

test('name-only participants are not silently merged', async () => {
  const { activityService, personService } = setup();
  const a = await activityService.create(officer, {
    title: 'A',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Sam Only' }],
  });
  const b = await activityService.create(officer, {
    title: 'B',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Sam Only' }],
  });
  assert.notEqual(a.participants[0].personId, b.participants[0].personId);
  const listed = await personService.list(reviewer, { search: 'Sam Only', limit: 50 });
  assert.equal(listed.total, 2);
  assert.ok(listed.data.every((p) => p.identityStatus === 'needs_review' || p.identityStatus === 'unverified'));
});

test('officers cannot link users; reviewers can', async () => {
  const { activityService, personService } = setup();
  const created = await activityService.create(officer, {
    title: 'A',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Person A', phone: '0700999001' }],
  });
  const personId = created.participants[0].personId as string;
  await assert.rejects(
    () => personService.linkUser(officer, personId, { identityUserId: personA.id }),
    (err: DomainError) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );
  const linked = await personService.linkUser(reviewer, personId, { identityUserId: personA.id });
  assert.equal(linked.identityUserId, personA.id);
});

test('ICT cannot search persons', async () => {
  const { personService } = setup();
  await assert.rejects(() => personService.list(ict, {}), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('Person with no IdentityUser is valid; merge is not implemented', async () => {
  const { activityService, personService } = setup();
  const created = await activityService.create(officer, {
    title: 'A',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'No Login', phone: '0700333333' }],
  });
  const person = await personService.getById(reviewer, created.participants[0].personId as string);
  assert.equal(person.identityUser, null);
  await assert.rejects(() => personService.merge(admin), (err: DomainError) => {
    assert.equal(err.statusCode, 501);
    return true;
  });
});

test('ensureForUser creates a Person for an IdentityUser with no directory row', async () => {
  const { accService, activityService, personService } = setup();
  const host = await activityService.create(officer, { title: 'Host', amount: 10, status: 'planned' });
  const created = await accService.create(officer, { activityId: host.id, lines: [{ description: 'x', amount: 1 }] });
  assert.ok(created.personId);
  const person = await personService.getById(reviewer, created.personId);
  assert.equal(person.identityUserId, officer.id);
});

test('link-participant records previous identity', async () => {
  const { activityService, personService } = setup();
  const a = await activityService.create(officer, {
    title: 'A',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Pat', phone: '0700444444' }],
  });
  const b = await activityService.create(officer, {
    title: 'B',
    amount: 10,
    status: 'planned',
    participants: [{ name: 'Pat Other', phone: '0700555555' }],
  });
  const target = b.participants[0].personId as string;
  const result = await personService.linkParticipant(reviewer, target, {
    participantId: a.participants[0].id,
    reason: 'same person confirmed',
  });
  assert.equal(result.participant.personId, target);
  const events = (await personService.getById(reviewer, target)).events;
  assert.ok(events.some((e) => e.action === 'LINKED_PARTICIPANT'));
});
