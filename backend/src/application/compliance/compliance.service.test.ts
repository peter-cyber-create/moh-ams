import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityService } from '../activity/activity.service.js';
import { AccountabilityService } from '../accountability/accountability.service.js';
import { ComplianceService } from './compliance.service.js';
import { MemoryActivityRepository, MemoryFileStore } from '../../infrastructure/memory-activity.repository.js';
import {
  MemoryAccountabilityRepository,
  MemoryIdentityLookup,
} from '../../infrastructure/memory-accountability.repository.js';
import { MemoryComplianceReadPort } from '../../infrastructure/memory-compliance.repository.js';
import { MemoryPersonRepository } from '../../infrastructure/memory-person.repository.js';
import { PersonService } from '../person/person.service.js';
import { DomainError } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };
const personA: Actor = {
  id: 'pa',
  email: 'a@x',
  name: 'Person A',
  module: 'Finance',
  roleName: 'User',
  isActive: true,
};
const reviewer: Actor = { id: 'u3', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };
const ict: Actor = { id: 'u2', email: 'i@x', name: 'Ict', module: 'ICT', roleName: 'User', isActive: true };

function endAfter(startIso: string, inclusiveDays: number) {
  const start = new Date(startIso);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + inclusiveDays - 1);
  return { activityDate: startIso, endDate: end.toISOString() };
}

function setup() {
  const activities = new MemoryActivityRepository();
  const files = new MemoryFileStore();
  const accRepo = new MemoryAccountabilityRepository(activities);
  const identity = new MemoryIdentityLookup([officer, personA, reviewer, ict]);
  const persons = new MemoryPersonRepository(activities, accRepo, identity);
  const personService = new PersonService(persons, identity);
  const activityService = new ActivityService(activities, files, personService);
  const accService = new AccountabilityService(accRepo, activities, files, identity, personService);
  const compliance = new ComplianceService(new MemoryComplianceReadPort(activities, accRepo, identity, persons));
  return { activities, activityService, accService, compliance, personService, persons };
}

async function activityWithDays(
  activityService: ActivityService,
  actor: Actor,
  title: string,
  inclusiveDays: number,
  participants: unknown,
  start = '2026-01-01T00:00:00.000Z',
) {
  const dates = endAfter(start, inclusiveDays);
  return activityService.create(actor, {
    title,
    amount: 100,
    status: 'planned',
    participants,
    ...dates,
  });
}

test('activity duration is stored from start and end dates', async () => {
  const { activityService } = setup();
  const created = await activityWithDays(activityService, officer, 'Forty', 40, [
    { name: 'Jane', phone: '0700111111' },
  ]);
  assert.equal(created.days, 40);
  assert.equal(created.participants[0].days, 40);
});

test('years are independent', async () => {
  const { activityService, compliance } = setup();
  await activityWithDays(activityService, officer, 'Y26', 10, [{ name: 'Jane', phone: '0700111111' }], '2026-03-01T00:00:00.000Z');
  await activityWithDays(activityService, officer, 'Y27', 20, [{ name: 'Jane', phone: '0700111111' }], '2027-03-01T00:00:00.000Z');
  const y26 = await compliance.participation(reviewer, { year: 2026 });
  const y27 = await compliance.participation(reviewer, { year: 2027 });
  assert.equal(y26.data[0].totalDays, 10);
  assert.equal(y27.data[0].totalDays, 20);
});

test('duplicate names with different phones are different people; case is normalized', async () => {
  const { activityService, compliance } = setup();
  await activityWithDays(activityService, officer, 'A', 5, [
    { name: 'JOHN DOE', phone: '0700111111' },
    { name: 'John Doe', phone: '0700222222' },
  ]);
  const list = await compliance.participation(reviewer, { year: 2026 });
  assert.equal(list.data.length, 2);
});

test('ICT user is 403 on compliance', async () => {
  const { compliance } = setup();
  await assert.rejects(() => compliance.overview(ict, { year: 2026 }), (err: DomainError) => {
    assert.equal(err.statusCode, 403);
    return true;
  });
});

test('mandatory acceptance: 150 then 160 plus overdue accountability then close', async () => {
  const { activityService, accService, compliance, personService } = setup();
  await activityWithDays(activityService, personA, 'A1', 40, [{ name: 'Person A', phone: '0700999001' }], '2026-01-01T00:00:00.000Z');
  await activityWithDays(activityService, personA, 'A2', 50, [{ name: 'Person A', phone: '0700999001' }], '2026-03-01T00:00:00.000Z');
  await activityWithDays(activityService, personA, 'A3', 60, [{ name: 'Person A', phone: '0700999001' }], '2026-06-01T00:00:00.000Z');

  const directory = await personService.list(reviewer, { phone: '0700999001' });
  assert.equal(directory.total, 1);
  const personId = directory.data[0].id;
  await personService.linkUser(reviewer, personId, { identityUserId: personA.id, reason: 'Wave 4 acceptance' });

  const at150 = await compliance.participation(reviewer, { year: 2026 });
  const person = at150.data.find((r) => r.personId === personId);
  assert.equal(person?.totalDays, 150);
  assert.equal(person?.participationStatus, 'threshold_reached');
  assert.equal(person?.flagged, true);
  assert.equal(person?.identityKey, personId);

  await activityWithDays(activityService, personA, 'A4', 10, [{ name: 'Person A', phone: '0700999001' }], '2026-09-01T00:00:00.000Z');
  const exceeded = await compliance.participation(reviewer, { year: 2026 });
  assert.equal(exceeded.data[0].totalDays, 160);
  assert.equal(exceeded.data[0].participationStatus, 'exceeded');
  assert.equal(exceeded.data[0].personId, personId);

  const host = await activityService.create(personA, {
    title: 'Accounted trip',
    amount: 500,
    status: 'planned',
    ...endAfter('2026-10-01T00:00:00.000Z', 3),
    participants: [{ name: 'Person A', phone: '0700999001' }],
  });
  await activityService.submitReport(personA, host.id, { originalname: 'r.pdf', size: 10 });
  const created = await accService.create(personA, {
    activityId: host.id,
    dueDate: '2020-01-01T00:00:00.000Z',
    lines: [{ description: 'Fuel', amount: 100 }],
  });
  await accService.submit(personA, created.id);
  await accService.assign(reviewer, created.id, { reviewerId: reviewer.id });

  const combined = await compliance.overview(reviewer, { year: 2026 });
  const row = combined.data.find((r) => r.personId === personId);
  assert.ok(row);
  assert.equal(row.participationStatus, 'exceeded');
  assert.ok(row.pendingCount >= 1);
  assert.ok(row.overdueCount >= 1);
  assert.ok(row.flags.includes('PARTICIPATION_EXCEEDED'));
  assert.ok(row.flags.includes('ACCOUNTABILITY_OVERDUE'));
  assert.equal(row.overallLabel, 'MULTIPLE ISSUES');
  assert.equal(row.accountabilities[0].referenceNumber, created.referenceNumber);

  await accService.approve(reviewer, created.id);
  await accService.close(reviewer, created.id);
  const afterClose = await compliance.overview(reviewer, { year: 2026 });
  const closedRow = afterClose.data.find((r) => r.personId === personId);
  assert.equal(closedRow?.participationStatus, 'exceeded');
  assert.equal(closedRow?.pendingCount, 0);
  assert.equal(closedRow?.overdueCount, 0);
  assert.ok(closedRow?.flags.includes('PARTICIPATION_EXCEEDED'));
  assert.equal(closedRow?.flags.includes('ACCOUNTABILITY_OVERDUE'), false);
});

test('returned and clarification remain pending; closed is not', async () => {
  const { activityService, accService, compliance } = setup();
  const host = await activityService.create(personA, {
    title: 'Case host',
    amount: 50,
    status: 'planned',
    ...endAfter('2026-02-01T00:00:00.000Z', 2),
  });
  await activityService.submitReport(personA, host.id, { originalname: 'r.pdf' });
  const created = await accService.create(personA, {
    activityId: host.id,
    lines: [{ description: 'x', amount: 1 }],
  });
  await accService.submit(personA, created.id);
  await accService.assign(reviewer, created.id, { reviewerId: reviewer.id });
  await accService.returnCase(reviewer, created.id, { reason: 'fix' });
  const returned = await compliance.accountabilities(reviewer, { year: 2026 });
  assert.equal(returned.data.some((a) => a.status === 'returned'), true);
});

test('participants on an activity are not auto-flagged for another officer accountability', async () => {
  const { activityService, accService, compliance } = setup();
  await activityWithDays(activityService, officer, 'Other people', 5, [{ name: 'Bystander', phone: '0700000002' }]);
  const host = await activityService.create(officer, {
    title: 'Officer case',
    amount: 50,
    status: 'planned',
    ...endAfter('2026-04-01T00:00:00.000Z', 2),
    participants: [{ name: 'Bystander', phone: '0700000002' }],
  });
  await activityService.submitReport(officer, host.id, { originalname: 'r.pdf' });
  const created = await accService.create(officer, {
    activityId: host.id,
    dueDate: '2020-01-01T00:00:00.000Z',
    lines: [{ description: 'x', amount: 1 }],
  });
  await accService.submit(officer, created.id);
  await accService.assign(reviewer, created.id, { reviewerId: reviewer.id });
  const overview = await compliance.overview(reviewer, { year: 2026 });
  const bystander = overview.data.find((r) => r.name === 'Bystander');
  const officerRow = overview.data.find((r) => r.name === 'Fin');
  assert.equal(bystander?.pendingCount || 0, 0);
  assert.ok((officerRow?.pendingCount || 0) >= 1);
  assert.notEqual(bystander?.personId, officerRow?.personId);
});

test('Wave 5 acceptance: monthly + early warning + pending + recalculate + overlap', async () => {
  const { activityService, accService, compliance, personService } = setup();
  await activityWithDays(activityService, personA, 'Y1', 120, [{ name: 'Person A', phone: '0700999001' }], '2026-01-01T00:00:00.000Z');
  await activityWithDays(activityService, personA, 'Aug15', 15, [{ name: 'Person A', phone: '0700999001' }], '2026-08-01T00:00:00.000Z');
  const directory = await personService.list(reviewer, { phone: '0700999001' });
  const personId = directory.data[0].id;
  await personService.linkUser(reviewer, personId, { identityUserId: personA.id });

  const host = await activityService.create(personA, {
    title: 'Acc host',
    amount: 50,
    status: 'planned',
    ...endAfter('2026-07-01T00:00:00.000Z', 2),
  });
  await activityService.submitReport(personA, host.id, { originalname: 'r.pdf' });
  const created = await accService.create(personA, {
    activityId: host.id,
    lines: [{ description: 'x', amount: 1 }],
  });
  await accService.submit(personA, created.id);
  await accService.assign(reviewer, created.id, { reviewerId: reviewer.id });

  const preview5 = await compliance.preview(officer, {
    title: 'August add-on',
    activityDate: '2026-08-20T00:00:00.000Z',
    endDate: endAfter('2026-08-20T00:00:00.000Z', 5).endDate,
    participants: [{ name: 'Person A', phone: '0700999001' }],
  });
  assert.equal(preview5.durationDays, 5);
  const row5 = preview5.participants[0];
  assert.equal(row5.projectedAnnualDays, 140);
  assert.equal(row5.earlyWarning, true);
  assert.equal(row5.projectedMonthDays, 20);
  assert.equal(row5.monthlyStatus, 'limit_reached');
  assert.equal(row5.accountability.pending >= 1, true);
  assert.equal(preview5.blocking, false);

  const preview10 = await compliance.preview(officer, {
    title: 'August add-on',
    activityDate: '2026-08-20T00:00:00.000Z',
    endDate: endAfter('2026-08-20T00:00:00.000Z', 10).endDate,
    participants: [{ name: 'Person A', phone: '0700999001' }],
  });
  const row10 = preview10.participants[0];
  assert.equal(row10.projectedAnnualDays, 145);
  assert.equal(row10.projectedMonthDays, 25);
  assert.equal(row10.monthlyStatus, 'exceeded');
  assert.equal(row10.earlyWarning, true);

  await activityWithDays(
    activityService,
    personA,
    'SepA',
    10,
    [{ name: 'Person A', phone: '0700999001' }],
    '2026-09-01T00:00:00.000Z',
  );
  const overlapPreview = await compliance.preview(officer, {
    title: 'SepB',
    activityDate: '2026-09-05T00:00:00.000Z',
    endDate: '2026-09-15T00:00:00.000Z',
    participants: [{ name: 'Person A', phone: '0700999001' }],
  });
  assert.ok(overlapPreview.summary.overlaps >= 1);
  assert.equal(overlapPreview.participants[0].overlap, true);
  assert.equal(overlapPreview.blocking, false);
});

test('Wave 5 acceptance: 145+5=threshold then 6=exceeded', async () => {
  const { activityService, compliance } = setup();
  await activityWithDays(activityService, officer, 'Base', 145, [{ name: 'Person B', phone: '0700888002' }], '2026-02-01T00:00:00.000Z');
  const at150 = await compliance.preview(officer, {
    activityDate: '2026-06-01T00:00:00.000Z',
    endDate: endAfter('2026-06-01T00:00:00.000Z', 5).endDate,
    participants: [{ name: 'Person B', phone: '0700888002' }],
  });
  assert.equal(at150.participants[0].projectedAnnualDays, 150);
  assert.equal(at150.participants[0].annualStatus, 'threshold_reached');
  const at151 = await compliance.preview(officer, {
    activityDate: '2026-06-01T00:00:00.000Z',
    endDate: endAfter('2026-06-01T00:00:00.000Z', 6).endDate,
    participants: [{ name: 'Person B', phone: '0700888002' }],
  });
  assert.equal(at151.participants[0].projectedAnnualDays, 151);
  assert.equal(at151.participants[0].annualStatus, 'exceeded');
});

test('Wave 5 acceptance: monthly 10+10 within then +1 exceeded', async () => {
  const { activityService, compliance } = setup();
  await activityWithDays(activityService, officer, 'BaseY', 100, [{ name: 'Person C', phone: '0700777003' }], '2026-01-01T00:00:00.000Z');
  await activityWithDays(activityService, officer, 'Mar10', 10, [{ name: 'Person C', phone: '0700777003' }], '2026-03-01T00:00:00.000Z');
  const at20 = await compliance.preview(officer, {
    activityDate: '2026-03-15T00:00:00.000Z',
    endDate: endAfter('2026-03-15T00:00:00.000Z', 10).endDate,
    participants: [{ name: 'Person C', phone: '0700777003' }],
  });
  assert.equal(at20.participants[0].projectedAnnualDays, 120);
  assert.equal(at20.participants[0].projectedMonthDays, 20);
  assert.equal(at20.participants[0].monthlyStatus, 'limit_reached');
  assert.equal(at20.participants[0].earlyWarning, true);
  const at21 = await compliance.preview(officer, {
    activityDate: '2026-03-15T00:00:00.000Z',
    endDate: endAfter('2026-03-15T00:00:00.000Z', 11).endDate,
    participants: [{ name: 'Person C', phone: '0700777003' }],
  });
  assert.equal(at21.participants[0].projectedMonthDays, 21);
  assert.equal(at21.participants[0].monthlyStatus, 'exceeded');
});

test('ICT cannot preview compliance', async () => {
  const { compliance } = setup();
  await assert.rejects(
    () =>
      compliance.preview(ict, {
        activityDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-02T00:00:00.000Z',
        participants: [{ name: 'X', phone: '0700111111' }],
      }),
    (err: DomainError) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );
});

test('closed accountability does not appear as pending in preview', async () => {
  const { activityService, accService, compliance, personService } = setup();
  await activityWithDays(activityService, personA, 'Base', 10, [{ name: 'Person A', phone: '0700999001' }], '2026-01-01T00:00:00.000Z');
  const directory = await personService.list(reviewer, { phone: '0700999001' });
  await personService.linkUser(reviewer, directory.data[0].id, { identityUserId: personA.id });
  const host = await activityService.create(personA, {
    title: 'Host',
    amount: 10,
    status: 'planned',
    ...endAfter('2026-02-01T00:00:00.000Z', 2),
  });
  await activityService.submitReport(personA, host.id, { originalname: 'r.pdf' });
  const created = await accService.create(personA, {
    activityId: host.id,
    lines: [{ description: 'x', amount: 1 }],
  });
  await accService.submit(personA, created.id);
  await accService.assign(reviewer, created.id, { reviewerId: reviewer.id });
  await accService.approve(reviewer, created.id);
  await accService.close(reviewer, created.id);
  const preview = await compliance.preview(officer, {
    activityDate: '2026-05-01T00:00:00.000Z',
    endDate: endAfter('2026-05-01T00:00:00.000Z', 3).endDate,
    participants: [{ name: 'Person A', phone: '0700999001' }],
  });
  assert.equal(preview.participants[0].accountability.pending, 0);
  assert.equal(preview.participants[0].accountability.overdue, 0);
  assert.equal(preview.participants[0].accountability.status, 'clear');
});
