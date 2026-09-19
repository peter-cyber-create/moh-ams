import { describe, expect, it } from 'vitest';
import { humanResultLabel, humanizeWarning, warningLevel } from './warnings.js';
import { REPORT_CATEGORIES } from '../pages/ReportsHubPage.jsx';

describe('human-readable compliance warnings', () => {
  it('rewrites technical flags into plain language', () => {
    expect(humanizeWarning('EARLY_WARNING for Jane')).toMatch(/approaching the annual/i);
    expect(humanizeWarning('OVERLAP_DETECTED')).toMatch(/already assigned/i);
    expect(humanizeWarning('MONTHLY_LIMIT_EXCEEDED')).toMatch(/20-day monthly/i);
  });

  it('classifies warning levels without relying on colour alone', () => {
    expect(warningLevel('exceeded the annual limit')).toBe('action');
    expect(warningLevel('approaching the annual field-day limit')).toBe('warning');
    expect(warningLevel('all clear')).toBe('normal');
  });

  it('maps result labels for the table', () => {
    expect(humanResultLabel('EARLY_WARNING')).toMatch(/Approaching/i);
    expect(humanResultLabel('CLEAR')).toBe('No issue');
  });
});

describe('reports landing categories', () => {
  it('exposes exactly four report categories', () => {
    expect(REPORT_CATEGORIES.map((c) => c.id)).toEqual(['activities', 'people', 'financial', 'compliance']);
  });
});
