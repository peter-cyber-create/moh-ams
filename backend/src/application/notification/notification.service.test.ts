import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityService } from '../activity/activity.service.js';
import { AccountabilityService } from '../accountability/accountability.service.js';
import { MemoryActivityRepository, MemoryFileStore } from '../../infrastructure/memory-activity.repository.js';
import {
  MemoryAccountabilityRepository,
  MemoryIdentityLookup,
} from '../../infrastructure/memory-accountability.repository.js';
import type { Actor } from '../../domain/activity/permissions.js';
import { MemoryPersonRepository } from '../../infrastructure/memory-person.repository.js';
import { PersonService } from '../person/person.service.js';
import { NOTIFICATION_TYPES } from '../../domain/notification/types.js';

/** In-memory stand-in for NotificationService (no Prisma). */
class MemoryNotificationService {
  items: Array<Record<string, unknown>> = [];
  async notify(input: {
    recipientUserId: string;
    type: string;
    title: string;
    message: string;
    dedupeKey: string;
    referenceType?: string | null;
    referenceId?: string | null;
    href?: string | null;
  }) {
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
    return { unreadCount: data.filter((n) => !n.isRead).length, data };
  }
  async markRead(recipientUserId: string, id: string) {
    const row = this.items.find((n) => n.id === id && n.recipientUserId === recipientUserId);
    if (!row) return null;
    row.isRead = true;
    return row;
  }
  async markAllRead(recipientUserId: string) {
    for (const n of this.items) {
      if (n.recipientUserId === recipientUserId) n.isRead = true;
    }
    return { ok: true };
  }
}

const officer: Actor = { id: 'u1', email: 'f@x', name: 'Fin', module: 'Finance', roleName: 'User', isActive: true };
const reviewer: Actor = { id: 'u3', email: 'r@x', name: 'Rev', module: 'Finance', roleName: 'Reviewer', isActive: true };

function setup() {
  const activities = new MemoryActivityRepository();
  const files = new MemoryFileStore();
  const identity = new MemoryIdentityLookup([officer, reviewer]);
  const persons = new MemoryPersonRepository(activities, undefined, identity);
  const personService = new PersonService(persons, identity);
  const activityService = new ActivityService(activities, files, personService);
  const accRepo = new MemoryAccountabilityRepository(activities);
  const notifications = new MemoryNotificationService();
  const service = new AccountabilityService(accRepo, activities, files, identity, personService, notifications as never);
  return { activityService, service, notifications };
}

test('accountability lifecycle creates in-app notifications without duplicates on stable keys', async () => {
  const { activityService, service, notifications } = setup();
  const activity = await activityService.create(officer, { title: 'Field', amount: 500, status: 'planned' });
  await activityService.submitReport(officer, activity.id, { originalname: 'r.pdf', size: 10 });
  const created = await service.create(officer, {
    activityId: activity.id,
    lines: [{ description: 'Fuel', amount: 200 }],
  });
  await service.assign(reviewer, created.id, { reviewerId: reviewer.id });
  assert.equal(
    notifications.items.filter((n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_ASSIGNED).length,
    1,
  );

  await service.submit(officer, created.id);
  assert.ok(notifications.items.some((n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_SUBMITTED));

  await service.returnCase(reviewer, created.id, { reason: 'Missing receipt' });
  assert.ok(
    notifications.items.some(
      (n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_RETURNED && n.recipientUserId === officer.id,
    ),
  );

  await service.resubmit(officer, created.id);
  assert.ok(
    notifications.items.some(
      (n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_RESUBMITTED && n.recipientUserId === reviewer.id,
    ),
  );

  await service.approve(reviewer, created.id, {});
  assert.ok(
    notifications.items.some(
      (n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_APPROVED && n.recipientUserId === officer.id,
    ),
  );

  await service.close(reviewer, created.id, {});
  assert.ok(
    notifications.items.some(
      (n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_CLOSED && n.recipientUserId === officer.id,
    ),
  );

  // Stable approve dedupe key — second notify with same key would be ignored by service.
  await notifications.notify({
    recipientUserId: officer.id,
    type: NOTIFICATION_TYPES.ACCOUNTABILITY_APPROVED,
    title: 'dup',
    message: 'dup',
    dedupeKey: `approved:${created.id}`,
  });
  assert.equal(
    notifications.items.filter((n) => n.type === NOTIFICATION_TYPES.ACCOUNTABILITY_APPROVED).length,
    1,
  );
});

test('notification mark read and mark all read', async () => {
  const notifications = new MemoryNotificationService();
  await notifications.notify({
    recipientUserId: 'u1',
    type: 'T',
    title: 'A',
    message: 'm',
    dedupeKey: 'k1',
  });
  await notifications.notify({
    recipientUserId: 'u1',
    type: 'T',
    title: 'B',
    message: 'm',
    dedupeKey: 'k2',
  });
  const listed = await notifications.list('u1');
  assert.equal(listed.unreadCount, 2);
  await notifications.markRead('u1', String(listed.data[0].id));
  assert.equal((await notifications.list('u1')).unreadCount, 1);
  await notifications.markAllRead('u1');
  assert.equal((await notifications.list('u1')).unreadCount, 0);
});
