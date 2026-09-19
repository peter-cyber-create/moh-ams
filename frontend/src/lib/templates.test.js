import { describe, expect, it } from 'vitest';
import { TEMPLATE_DOWNLOADS } from './templates.js';
import {
  REGISTER_STEPS,
  activityPayloadFromForm,
  emptyActivityForm,
  summarizePreview,
  validateActivityForm,
} from './registerActivity.js';

describe('templates', () => {
  it('exposes only the participant template download', () => {
    expect(TEMPLATE_DOWNLOADS.participants).toBe('/api/v1/activities/templates/participants');
    expect(TEMPLATE_DOWNLOADS.activityDetails).toBeUndefined();
  });
});

describe('three-step registration helpers', () => {
  it('exposes Activity → Participants → Check & Submit', () => {
    expect(REGISTER_STEPS).toEqual(['Activity', 'Participants', 'Check & Submit']);
  });

  it('validates required activity fields', () => {
    expect(validateActivityForm(emptyActivityForm())).toMatch(/name/i);
    expect(
      validateActivityForm({
        ...emptyActivityForm(),
        activityName: 'Visit',
        requestedBy: 'Jane',
        dept: 'Planning',
        invoiceDate: '2026-09-01',
        amt: '1000',
        funder: 'GOU',
      }),
    ).toBe('');
  });

  it('builds create payload from the form', () => {
    const body = activityPayloadFromForm(
      {
        ...emptyActivityForm(),
        activityName: 'Visit',
        requestedBy: 'Jane',
        dept: 'Planning',
        invoiceDate: '2026-09-01',
        amt: '1,000',
        funder: 'GOU',
      },
      'planned',
      [{ name: 'Sam', title: '', phone: '', amount: 0, days: 0 }],
    );
    expect(body.title).toBe('Visit');
    expect(body.amount).toBe(1000);
    expect(body.participants).toHaveLength(1);
  });

  it('summarizes compliance preview for batch check', () => {
    expect(summarizePreview({ summary: {} }).level).toBe('ok');
    expect(summarizePreview({ summary: { exceeded: 2 } }).level).toBe('alert');
    expect(summarizePreview({ summary: { overlaps: 1 } }).level).toBe('warn');
  });
});
