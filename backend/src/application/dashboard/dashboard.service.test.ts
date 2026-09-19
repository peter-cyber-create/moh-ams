import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityService } from '../activity/activity.service.js';
import { AccountabilityService } from '../accountability/accountability.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';
import { DashboardService } from './dashboard.service.js';
import { MemoryActivityRepository, MemoryFileStore } from '../../infrastructure/memory-activity.repository.js';
import {
  MemoryAccountabilityRepository,
  MemoryIdentityLookup,
} from '../../infrastructure/memory-accountability.repository.js';
import { MemoryComplianceReadPort } from '../../infrastructure/memory-compliance.repository.js';
import { MemoryPersonRepository } from '../../infrastructure/memory-person.repository.js';
import { PersonService } from '../person/person.service.js';
import type { Actor } from '../../domain/activity/permissions.js';

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };

class MemoryNotificationService {
  items: Array<Record<string, unknown>> = [];
  async notify(input: Record<string, unknown>) {
    const exists = this.items.find(
      (n) =>
        n.recipientUserId === input.recipientUserId &&
        n.type === input.type &&
        n.dedupeKey === input.dedupeKey,
    );
    if (exists) return null;
    const row = { id: `n${this.items.length + 1}`, isRead: false, ...input };
    this.items.push(row);
    return row;
  }
  async list(recipientUserId: string) {
    const data = this.items.filter((n) => n.recipientUserId === recipientUserId);
    return { data, unreadCount: data.filter((n) => !n.isRead).length };
  }
}

function setup() {
  const activities = new MemoryActivityRepository();
  const files = new MemoryFileStore();
  const accRepo = new MemoryAccountabilityRepository(activities);
  const identity = new MemoryIdentityLookup([officer]);
  const persons = new MemoryPersonRepository(activities, accRepo, identity);
  const personService = new PersonService(persons, identity);
  const activityService = new ActivityService(activities, files, personService);
  const accService = new AccountabilityService(accRepo, activities, files, identity, personService);
  const compliance = new ComplianceService(new MemoryComplianceReadPort(activities, accRepo, identity, persons));
  const notifications = new MemoryNotificationService();
  const dashboard = new DashboardService(activityService, accService, compliance, notifications as never);
  return { activityService, accService, dashboard };
}

test('dashboard overview returns server-calculated activity and accountability counts', async () => {
  const { activityService, accService, dashboard } = setup();
  const year = new Date().getUTCFullYear();
  const created = await activityService.create(officer, {
    title: 'Field visit',
    amount: 500,
    status: 'planned',
    activityDate: `${year}-03-01`,
  });
  await activityService.update(officer, created.id, { status: 'ongoing' });
  await activityService.submitReport(officer, created.id, { originalname: 'a.pdf', size: 10 });

  await accService.create(officer, {
    activityId: created.id,
    dueDate: `${year}-04-01`,
    lines: [{ description: 'Fuel', amount: 100 }],
  });
  const row = (await accService.list(officer, { view: 'all' })).data[0];
  await accService.submit(officer, row.id);

  const overview = await dashboard.getOverview(officer, year);
  assert.equal(overview.stats.activities.total.value, 1);
  assert.equal(overview.stats.accountability.total.value, 1);
  assert.equal(overview.stats.accountability.pending.value, 1);
  assert.equal(overview.stats.accountability.pending.href, '/accountability?view=pending');
});

test('dashboard attention hides zero-state issues', async () => {
  const { dashboard } = setup();
  const overview = await dashboard.getOverview(officer, new Date().getUTCFullYear());
  assert.equal(overview.caughtUp, true);
  assert.equal(overview.attention.length, 0);
});

test('activity countStats excludes cancelled activities in year scope', async () => {
  const { activityService } = setup();
  const year = new Date().getUTCFullYear();
  const planned = await activityService.create(officer, {
    title: 'Live',
    amount: 1,
    status: 'planned',
    activityDate: `${year}-02-02`,
  });
  await activityService.update(officer, planned.id, { status: 'cancelled' });
  const stats = await activityService.countStats(officer, year);
  assert.equal(stats.total, 0);
});
