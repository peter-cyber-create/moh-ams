import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityService } from './activity.service.js';
import { ActivityReportQueries } from './reports.js';
import { MemoryActivityRepository, MemoryFileStore } from '../../infrastructure/memory-activity.repository.js';
import { DomainError } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';
import { MemoryIdentityLookup } from '../../infrastructure/memory-accountability.repository.js';
import { MemoryPersonRepository } from '../../infrastructure/memory-person.repository.js';
import { PersonService } from '../person/person.service.js';

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };
const ict: Actor = { id: 'u2', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };
const reviewer: Actor = { id: 'u3', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };

function setup() {
  const repo = new MemoryActivityRepository();
  const identity = new MemoryIdentityLookup([officer, ict, reviewer]);
  const persons = new MemoryPersonRepository(repo, undefined, identity);
  const personService = new PersonService(persons, identity);
  const service = new ActivityService(repo, new MemoryFileStore(), personService);
  const reports = new ActivityReportQueries(repo);
  return { repo, service, reports, personService };
}

test('unauthorized module cannot create', async () => {
  const { service } = setup();
  await assert.rejects(() => service.create(ict, { title: 'X', amount: 1, status: 'planned' }), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('create planned activity and read it', async () => {
  const { service } = setup();
  const created = await service.create(officer, {
    title: 'Field visit',
    amount: 100,
    status: 'planned',
    participants: [{ name: 'Jane', days: 2, amount: 50 }],
  });
  assert.equal(created.status, 'planned');
  assert.equal(created.participants.length, 1);
  const got = await service.getById(officer, created.id);
  assert.equal(got.title, 'Field visit');
});

test('draft does not appear as official and submit promotes it', async () => {
  const { service } = setup();
  const draft = await service.create(officer, { title: 'WIP', amount: 20, status: 'draft' });
  const listed = await service.list(officer, { page: 1, limit: 20 });
  assert.equal(listed.total, 0);
  const submitted = await service.submitDraft(officer, draft.id);
  assert.equal(submitted.status, 'planned');
});

test('invalid status transition is rejected', async () => {
  const { service } = setup();
  const created = await service.create(officer, { title: 'A', amount: 10, status: 'planned' });
  await assert.rejects(() => service.update(officer, created.id, { status: 'closed' }), /transition/);
});

test('officer cannot close; reviewer can after report', async () => {
  const { service } = setup();
  const created = await service.create(officer, { title: 'A', amount: 10, status: 'planned' });
  await service.update(officer, created.id, { status: 'ongoing' });
  const reported = await service.submitReport(officer, created.id, { originalname: 'a.pdf', size: 10 });
  assert.equal(reported.status, 'report_submitted');
  assert.equal(reported.hasActivityReport, true);
  await assert.rejects(() => service.update(officer, created.id, { status: 'closed' }), DomainError);
  const closed = await service.update(reviewer, created.id, { status: 'closed' });
  assert.equal(closed.status, 'closed');
});

test('missing-report query does not use completed', async () => {
  const { service, reports } = setup();
  const created = await service.create(officer, { title: 'Due', amount: 10, status: 'planned' });
  const due = await reports.missingReport(officer);
  assert.equal(due.data.some((r) => r.id === created.id), true);
  await service.submitReport(officer, created.id, { originalname: 'a.pdf' });
  const after = await reports.missingReport(officer);
  assert.equal(after.data.some((r) => r.id === created.id), false);
});

test('timeline records create and report', async () => {
  const { service } = setup();
  const created = await service.create(officer, { title: 'A', amount: 10, status: 'planned' });
  await service.submitReport(officer, created.id, { originalname: 'a.pdf' });
  const tl = await service.timeline(officer, created.id);
  assert.ok(tl.data.some((e) => e.action === 'CREATED'));
  assert.ok(tl.data.some((e) => e.action === 'REPORT_UPLOADED'));
});
