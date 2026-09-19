import { describe, expect, it } from 'vitest';
import { complianceQuery, emptyComplianceCopy, flagTone } from './compliance.js';
import { primaryNav, roleProfile } from './ams.js';

describe('compliance navigation', () => {
  it('shows Compliance in the primary sidebar for officers and reviewers', () => {
    expect(primaryNav({ module: 'Finance', role: { name: 'Reviewer' } }).map((i) => i.label)).toContain(
      'Compliance',
    );
    expect(primaryNav({ module: 'Finance', role: { name: 'User' } }).map((i) => i.label)).toContain('Compliance');
    expect(roleProfile({ module: 'Finance', role: { name: 'Reviewer' } }).isReviewer).toBe(true);
  });
});

describe('compliance list helpers', () => {
  it('builds year, search and overdue query params for server-side filters', () => {
    expect(complianceQuery({ year: 2026, search: 'Jane', overdue: true, page: 2 })).toMatchObject({
      year: 2026,
      search: 'Jane',
      overdue: true,
      page: 2,
    });
  });

  it('builds Wave 5 monthly, early-warning and overlap filters', () => {
    expect(
      complianceQuery({
        year: 2026,
        month: 8,
        earlyWarning: true,
        monthlyLimit: true,
        monthlyExceeded: true,
        overlap: true,
      }),
    ).toMatchObject({
      year: 2026,
      month: 8,
      earlyWarning: true,
      monthlyLimit: true,
      monthlyExceeded: true,
      overlap: true,
    });
  });

  it('has empty-state copy per tab', () => {
    expect(emptyComplianceCopy('participation')).toMatch(/No participation/);
    expect(emptyComplianceCopy('accountabilities')).toMatch(/No pending/);
    expect(emptyComplianceCopy('quality')).toMatch(/No data-quality/);
    expect(emptyComplianceCopy('monthly')).toMatch(/No monthly/);
    expect(emptyComplianceCopy('overlaps')).toMatch(/No overlapping/);
  });

  it('tones CLEAR vs action flags', () => {
    expect(flagTone('CLEAR')).toBe('ok');
    expect(flagTone('EARLY WARNING')).toBe('info');
    expect(flagTone('ACCOUNTABILITY OVERDUE')).toBe('warn');
  });
});
