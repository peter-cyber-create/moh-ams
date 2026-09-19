import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVITY_STATUSES,
  FLAG_DAY_THRESHOLD,
  activeNavGroupId,
  canEditActivity,
  canTransition,
  loadLocalDraft,
  needsActivityReport,
  primaryNav,
  moreNav,
  isNavActive,
  isNavChildActive,
  roleProfile,
  sanitizeParticipants,
  saveLocalDraft,
  clearLocalDraft,
  sidebarNav,
  statusLabel,
  validateReportFile,
} from './ams.js';
import { newMultiActivitySlot } from './registerActivity.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

globalThis.localStorage = new MemoryStorage();

afterEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

describe('authentication-related role navigation', () => {
  it('shows Dashboard and core sidebar groups for a finance officer', () => {
    const officer = { module: 'Finance', role: { name: 'User' } };
    expect(roleProfile(officer).isOfficer).toBe(true);
    expect(roleProfile(officer).isAdmin).toBe(false);
    const labels = primaryNav(officer).map((i) => i.label);
    expect(labels).toEqual(['Dashboard', 'Activities', 'Accountability', 'Compliance', 'Reports', 'More']);
    expect(labels.every((l) => l !== 'Administration')).toBe(true);
    expect(labels.every((l) => l !== 'Home')).toBe(true);
  });

  it('exposes Activities children and Accountability queues', () => {
    const officer = { module: 'Finance', role: { name: 'User' } };
    const nav = sidebarNav(officer);
    const activities = nav.find((i) => i.id === 'activities');
    expect(activities.children.map((c) => c.label)).toEqual(['All Activities', 'New Activity']);
    expect(activities.children.map((c) => c.label)).not.toContain('Multiple Activities');
    const acc = nav.find((i) => i.id === 'accountability');
    expect(acc.children.map((c) => c.label)).toContain('All');
    expect(acc.children.map((c) => c.label)).not.toContain('My Cases');
    expect(acc.children.map((c) => c.label)).toContain('Overdue');
    expect(acc.children.map((c) => c.label)).not.toContain('Under Review');
  });

  it('shows review queue for reviewers and compliance children', () => {
    const reviewer = { module: 'Finance', role: { name: 'Reviewer' } };
    const labels = primaryNav(reviewer).map((i) => i.label);
    expect(labels).toContain('Compliance');
    expect(labels).not.toContain('Persons');
    const acc = sidebarNav(reviewer).find((i) => i.id === 'accountability');
    expect(acc.children.map((c) => c.label)).toContain('Under Review');
    const compliance = sidebarNav(reviewer).find((i) => i.id === 'compliance');
    expect(compliance.children.map((c) => c.label)).toEqual([
      'Overview',
      'Participation',
      'Monthly',
      'Accountabilities',
      'Overlaps',
    ]);
  });

  it('keeps Administration nested under More for admins only', () => {
    const admin = { module: 'Admin', role: { name: 'Admin' } };
    const officer = { module: 'Finance', role: { name: 'User' } };
    expect(moreNav(admin).map((i) => i.title)).toContain('Administration');
    expect(moreNav(officer).map((i) => i.title)).not.toContain('Administration');
    expect(moreNav(admin).map((i) => i.title)[0]).toBe('My Profile');
    const adminMore = sidebarNav(admin).find((i) => i.id === 'more');
    const adminGroup = adminMore.children.find((c) => c.id === 'administration');
    expect(adminGroup.children.map((c) => c.label)).toEqual(['Users', 'Roles & Access']);
    expect(isNavActive({ to: '/activities', match: ['/activities'] }, '/activities/register')).toBe(true);
    expect(isNavActive({ to: '/activities', match: ['/activities'] }, '/activities/templates')).toBe(false);
    expect(isNavActive({ to: '/more', match: ['/more'] }, '/activities/templates')).toBe(true);
    expect(isNavChildActive({ to: '/accountability?view=overdue', label: 'Overdue' }, '/accountability', '?view=overdue')).toBe(
      true,
    );
    expect(isNavChildActive({ to: '/accountability?view=all', label: 'All' }, '/accountability', '')).toBe(true);
    expect(isNavChildActive({ to: '/activities', label: 'All', exact: true }, '/activities/register', '')).toBe(false);
    expect(activeNavGroupId(officer, '/activities/register', '')).toBe('activities');
    expect(activeNavGroupId(admin, '/admin/users', '')).toBe('more');
  });
});

describe('activity statuses', () => {
  it('labels only statuses the backend writes', () => {
    expect(ACTIVITY_STATUSES).toEqual(['draft', 'planned', 'ongoing', 'report_submitted', 'closed', 'cancelled']);
    expect(statusLabel('planned')).toBe('Planned');
    expect(statusLabel('report_submitted')).toBe('Report submitted');
    expect(statusLabel('under_review')).toBe('Under review');
    expect(statusLabel('clarification_requested')).toBe('Clarification requested');
    expect(statusLabel('returned')).toBe('Returned');
    expect(statusLabel('approved')).toBe('Approved');
    expect(statusLabel('rejected')).toBe('Rejected');
    expect(statusLabel('completed')).toBe('completed');
  });

  it('rejects invalid status transitions', () => {
    expect(canTransition('planned', 'ongoing')).toBe(true);
    expect(canTransition('planned', 'closed')).toBe(false);
    expect(canTransition('planned', 'completed')).toBe(false);
    expect(canTransition('closed', 'ongoing')).toBe(false);
    expect(canEditActivity({ status: 'planned' })).toBe(true);
    expect(canEditActivity({ status: 'closed' })).toBe(false);
  });
});

describe('CURRENT LEGACY DUE LOGIC', () => {
  it('is true when reportPath is missing and status is not closed or cancelled', () => {
    expect(needsActivityReport({ status: 'planned', reportPath: null })).toBe(true);
    expect(needsActivityReport({ status: 'ongoing', reportPath: '' })).toBe(true);
    expect(needsActivityReport({ status: 'report_submitted', reportPath: '/uploads/reports/a.pdf' })).toBe(false);
    expect(needsActivityReport({ status: 'closed', reportPath: null })).toBe(false);
    expect(needsActivityReport({ status: 'cancelled', reportPath: null })).toBe(false);
  });
});

describe('compliance calculation', () => {
  it('uses a hardcoded 150-day threshold', () => {
    expect(FLAG_DAY_THRESHOLD).toBe(150);
  });
});

describe('participants', () => {
  it('rejects malformed participant rows', () => {
    expect(sanitizeParticipants(null)).toEqual([]);
    expect(() => sanitizeParticipants({})).toThrow(/list/i);
    expect(() => sanitizeParticipants([{ title: 'x' }])).toThrow(/name/);
    const rows = sanitizeParticipants([{ name: ' Jane ', amount: '10', days: '2' }]);
    expect(rows[0]).toMatchObject({ name: 'Jane', amount: 10, days: 2 });
  });
});

describe('local drafts', () => {
  it('saves and resumes a browser-local draft, and drops malformed JSON', () => {
    saveLocalDraft({ activityName: 'Field visit', _participants: [{ name: 'A' }] });
    expect(loadLocalDraft().activityName).toBe('Field visit');
    localStorage.setItem('ams_activity_draft', '{not json');
    expect(loadLocalDraft()).toBe(null);
    clearLocalDraft();
    expect(loadLocalDraft()).toBe(null);
  });
});

describe('upload validation', () => {
  it('allows pdf/doc/docx under 5MB and rejects other types', () => {
    expect(validateReportFile({ name: 'a.pdf', size: 100 })).toBe('');
    expect(validateReportFile({ name: 'a.exe', size: 100 })).toMatch(/file type/i);
    expect(validateReportFile({ name: 'a.pdf', size: 6 * 1024 * 1024 })).toMatch(/5MB/i);
    expect(validateReportFile(null)).toMatch(/attach/i);
  });
});

describe('activity creation payload', () => {
  it('keeps create status as planned', () => {
    expect(ACTIVITY_STATUSES.includes('planned')).toBe(true);
  });

  it('supports adding another activity slot in the registration wizard', () => {
    const slot = newMultiActivitySlot(0);
    expect(slot.form.activityName).toBe('');
    expect(slot.selected).toBe(true);
  });
});
