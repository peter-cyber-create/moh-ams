import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityService } from '../activity/activity.service.js';
import { AccountabilityService } from './accountability.service.js';
import { MemoryActivityRepository, MemoryFileStore } from '../../infrastructure/memory-activity.repository.js';
import {
  MemoryAccountabilityRepository,
  MemoryIdentityLookup,
} from '../../infrastructure/memory-accountability.repository.js';
import { DomainError } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';
import { ACCOUNTABILITY_DUE_DAYS } from '../../domain/accountability/statuses.js';
import { MemoryPersonRepository } from '../../infrastructure/memory-person.repository.js';
import { PersonService } from '../person/person.service.js';

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };
const ict: Actor = { id: 'u2', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };
const reviewer: Actor = { id: 'u3', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };
const otherReviewer: Actor = {
  id: 'u4',
  email: 'r2@x',
  name: 'Rev2',
  module: 'Finance',
  roleName: 'Reviewer',
  isActive: true,
};

function setup() {
  const activities = new MemoryActivityRepository();
  const files = new MemoryFileStore();
  const identity = new MemoryIdentityLookup([officer, reviewer, otherReviewer, ict]);
  const persons = new MemoryPersonRepository(activities, undefined, identity);
  const personService = new PersonService(persons, identity);
  const activityService = new ActivityService(activities, files, personService);
  const accRepo = new MemoryAccountabilityRepository(activities);
  const service = new AccountabilityService(accRepo, activities, files, identity, personService);
  return { activities, activityService, service, accRepo };
}

async function plannedActivity(activityService: ActivityService, title = 'Field visit') {
  return activityService.create(officer, { title, amount: 1000, status: 'planned' });
}

async function draftCase(activityService: ActivityService, service: AccountabilityService, withReport = true) {
  const activity = await plannedActivity(activityService);
  if (withReport) {
    await activityService.submitReport(officer, activity.id, { originalname: 'report.pdf', size: 10 });
  }
  const created = await service.create(officer, {
    activityId: activity.id,
    lines: [{ description: 'Fuel', amount: 400 }],
  });
  return { activity, created };
}

async function underReview(activityService: ActivityService, service: AccountabilityService) {
  const { created } = await draftCase(activityService, service);
  await service.submit(officer, created.id);
  return service.assign(reviewer, created.id, { reviewerId: reviewer.id });
}

test('unauthorized module cannot create accountability', async () => {
  const { service, activityService } = setup();
  const activity = await plannedActivity(activityService);
  await assert.rejects(() => service.create(ict, { activityId: activity.id }), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('create accountability linked to activity with unique reference', async () => {
  const { service, activityService } = setup();
  const { created, activity } = await draftCase(activityService, service);
  assert.match(created.referenceNumber, /^ACC-\d{4}-\d{6}$/);
  assert.equal(created.activityId, activity.id);
  assert.equal(created.status, 'draft');
  assert.equal(created.amountAdvanced, 1000);
  const got = await service.getById(officer, created.id);
  assert.equal(got.id, created.id);
  const second = await service.create(officer, {
    activityId: (await plannedActivity(activityService, 'Second')).id,
    lines: [{ description: 'Per diem', amount: 100 }],
  });
  assert.notEqual(second.referenceNumber, created.referenceNumber);
});

test('update draft financial lines', async () => {
  const { service, activityService } = setup();
  const { created } = await draftCase(activityService, service);
  const updated = await service.update(officer, created.id, {
    lines: [{ description: 'Hotel', amount: 250 }],
    amountReturned: 50,
  });
  assert.equal(updated.lines.length, 1);
  assert.equal(updated.lines[0].description, 'Hotel');
  assert.equal(updated.amountReturned, 50);
  assert.equal(updated.outstandingBalance, 1000 - 250 - 50);
});

test('submit, assign reviewer, and reviewer access', async () => {
  const { service, activityService } = setup();
  const { created } = await draftCase(activityService, service);
  const submitted = await service.submit(officer, created.id);
  assert.equal(submitted.status, 'submitted');
  const assigned = await service.assign(reviewer, created.id, { reviewerId: reviewer.id });
  assert.equal(assigned.status, 'under_review');
  assert.equal(assigned.reviewerId, reviewer.id);
  const queue = await service.list(reviewer, { view: 'review' });
  assert.equal(queue.data.some((r) => r.id === created.id), true);
  const seen = await service.getById(reviewer, created.id);
  assert.equal(seen.id, created.id);
});

test('return requires a reason and resubmit returns to review', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  await assert.rejects(() => service.returnCase(reviewer, row.id, {}), /reason/);
  const returned = await service.returnCase(reviewer, row.id, { reason: 'Missing receipts' });
  assert.equal(returned.status, 'returned');
  assert.equal(returned.returnReason, 'Missing receipts');
  const resubmitted = await service.resubmit(officer, row.id);
  assert.equal(resubmitted.status, 'under_review');
});

test('clarification is separate from return and does not require rewriting lines', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  const asked = await service.requestClarification(reviewer, row.id, { question: 'Which venue?' });
  assert.equal(asked.status, 'clarification_requested');
  assert.equal(asked.lines.length, 1);
  const open = asked.clarifications[0];
  const answered = await service.respondClarification(officer, row.id, open.id, { response: 'Kampala' });
  assert.equal(answered.status, 'under_review');
  assert.equal(answered.clarifications[0].status, 'answered');
});

test('approve does not auto-close; close is a separate action', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  const approved = await service.approve(reviewer, row.id, { note: 'In order' });
  assert.equal(approved.status, 'approved');
  const closed = await service.close(reviewer, row.id, { reason: 'File complete' });
  assert.equal(closed.status, 'closed');
});

test('reject is terminal and requires a reason', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  await assert.rejects(() => service.reject(reviewer, row.id, {}), /reason/);
  const rejected = await service.reject(reviewer, row.id, { reason: 'Unsupported expenditure' });
  assert.equal(rejected.status, 'rejected');
  await assert.rejects(() => service.update(officer, row.id, { amountReturned: 1 }), DomainError);
});

test('invalid transition is rejected', async () => {
  const { service, activityService } = setup();
  const { created } = await draftCase(activityService, service);
  await assert.rejects(() => service.resubmit(officer, created.id), /returned/);
  await assert.rejects(() => service.update(officer, created.id, { status: 'approved' }), /named action/);
});

test('unauthorized officer cannot review', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  await assert.rejects(() => service.approve(officer, row.id), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('wrong reviewer cannot decide', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  await assert.rejects(() => service.approve(otherReviewer, row.id), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('duplicate open case for the same activity is rejected', async () => {
  const { service, activityService } = setup();
  const { activity } = await draftCase(activityService, service);
  await assert.rejects(() => service.create(officer, { activityId: activity.id }), /open accountability/);
});

test('closed case cannot be modified', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  await service.approve(reviewer, row.id);
  await service.close(reviewer, row.id);
  await assert.rejects(() => service.update(officer, row.id, { amountReturned: 1 }), /closed/);
  await assert.rejects(() => service.addDocument(officer, row.id, { originalname: 'x.pdf' }), DomainError);
});

test('due date defaults to 60 days from creation', async () => {
  const { service, activityService } = setup();
  const { created } = await draftCase(activityService, service);
  const expected = new Date(created.createdAt);
  expected.setUTCDate(expected.getUTCDate() + ACCOUNTABILITY_DUE_DAYS);
  assert.equal(new Date(created.dueDate).toDateString(), expected.toDateString());
});

test('activity relationship is preserved without duplicating the activity master', async () => {
  const { service, activityService } = setup();
  const { created, activity } = await draftCase(activityService, service);
  assert.equal(created.activity.id, activity.id);
  assert.equal(created.activity.title, activity.title);
  assert.equal(created.activity.hasActivityReport, true);
});

test('document upload is stored on the accountability case', async () => {
  const { service, activityService } = setup();
  const activity = await plannedActivity(activityService);
  const created = await service.create(officer, {
    activityId: activity.id,
    lines: [{ description: 'Fuel', amount: 10 }],
  });
  const withDoc = await service.addDocument(officer, created.id, { originalname: 'receipt.pdf', size: 20 });
  assert.equal(withDoc.documents.length, 1);
  assert.match(withDoc.documents[0].storedPath, /receipt\.pdf/);
  const docs = await service.documents(officer, created.id);
  assert.equal(docs.data.length, 1);
});

test('timeline records create, submit, assign and approve', async () => {
  const { service, activityService } = setup();
  const row = await underReview(activityService, service);
  await service.approve(reviewer, row.id);
  const timeline = await service.timeline(officer, row.id);
  const actions = timeline.data.map((e) => e.action);
  assert.deepEqual(
    ['CREATED', 'SUBMITTED', 'REVIEWER_ASSIGNED', 'APPROVED'].every((a) => actions.includes(a)),
    true,
  );
});

test('submit without evidence is rejected', async () => {
  const { service, activityService } = setup();
  const { created } = await draftCase(activityService, service, false);
  await assert.rejects(() => service.submit(officer, created.id), /supporting documents|activity report/);
});
