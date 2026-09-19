import { describe, expect, it } from 'vitest';
import { inclusiveDaysFromDates } from './compliancePreview.js';
import {
  ANNUAL_EARLY_WARNING_THRESHOLD,
  FLAG_DAY_THRESHOLD,
  MONTHLY_FIELD_DAY_LIMIT,
} from './ams.js';

describe('compliance preview helpers', () => {
  it('uses inclusive UTC calendar days', () => {
    expect(inclusiveDaysFromDates('2026-08-01', '2026-08-05')).toBe(5);
    expect(inclusiveDaysFromDates('2026-08-01', '2026-08-01')).toBe(1);
  });

  it('exposes Wave 5 thresholds for UI copy', () => {
    expect(MONTHLY_FIELD_DAY_LIMIT).toBe(20);
    expect(ANNUAL_EARLY_WARNING_THRESHOLD).toBe(120);
    expect(FLAG_DAY_THRESHOLD).toBe(150);
  });
});
