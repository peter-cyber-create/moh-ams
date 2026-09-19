export const PARTICIPATION_DAY_THRESHOLD = 150;
export const ANNUAL_FIELD_DAY_LIMIT = PARTICIPATION_DAY_THRESHOLD;
export const ANNUAL_EARLY_WARNING_THRESHOLD = 120;
export const NEAR_LIMIT_REMAINING = 15;
export const EXCLUDED_ACTIVITY_STATUSES = ['draft', 'cancelled'] as const;

export type ParticipationThresholdStatus = 'within_limit' | 'threshold_reached' | 'exceeded';

/** Wave 5 annual warning band. Independent of NEAR_LIMIT (remaining ≤ 15). */
export type AnnualWarningStatus = 'normal' | 'early_warning' | 'threshold_reached' | 'exceeded';

export function utcDateParts(value: Date): { y: number; m: number; d: number } {
  return { y: value.getUTCFullYear(), m: value.getUTCMonth(), d: value.getUTCDate() };
}

export function utcDayUtc(value: Date): number {
  const { y, m, d } = utcDateParts(value);
  return Date.UTC(y, m, d);
}

/** Inclusive calendar days. Null when end is before start. */
export function inclusiveCalendarDays(start: Date, end: Date): number | null {
  const diff = Math.floor((utcDayUtc(end) - utcDayUtc(start)) / 86400000) + 1;
  if (diff < 1) return null;
  return diff;
}

export type ActivityDurationInput = {
  activityDate: Date | null;
  endDate?: Date | null;
  days?: number | null;
};

export type DurationProvenance = 'DATE_CALCULATED' | 'LEGACY_STORED_DAYS' | 'DEFAULTED' | 'NEEDS_REVIEW';

export type ActivityDuration = {
  days: number | null;
  year: number | null;
  issues: string[];
  provenance: DurationProvenance;
  crossYear: boolean;
};

export function activityDuration(activity: ActivityDurationInput): ActivityDuration {
  const issues: string[] = [];
  const start = activity.activityDate;
  const end = activity.endDate ?? null;
  if (!start) {
    return { days: null, year: null, issues: ['missing_start_date'], provenance: 'NEEDS_REVIEW', crossYear: false };
  }
  const year = start.getUTCFullYear();
  if (end) {
    const crossYear = end.getUTCFullYear() !== year;
    if (crossYear) issues.push('spans_years');
    const days = inclusiveCalendarDays(start, end);
    if (days == null) {
      return { days: null, year, issues: [...issues, 'end_before_start'], provenance: 'NEEDS_REVIEW', crossYear };
    }
    if (crossYear) issues.push('CROSS_YEAR_REVIEW');
    return { days, year, issues, provenance: 'DATE_CALCULATED', crossYear };
  }
  if (activity.days != null && activity.days > 0) {
    return {
      days: activity.days,
      year,
      issues: [...issues, 'duration_from_activity_days_snapshot'],
      provenance: 'LEGACY_STORED_DAYS',
      crossYear: false,
    };
  }
  return {
    days: 1,
    year,
    issues: [...issues, 'end_date_missing_counted_as_one_day'],
    provenance: 'DEFAULTED',
    crossYear: false,
  };
}

export function isParticipationEligibleStatus(status: string): boolean {
  return !(EXCLUDED_ACTIVITY_STATUSES as readonly string[]).includes(status);
}

export function thresholdStatus(totalDays: number): ParticipationThresholdStatus {
  if (totalDays > PARTICIPATION_DAY_THRESHOLD) return 'exceeded';
  if (totalDays === PARTICIPATION_DAY_THRESHOLD) return 'threshold_reached';
  return 'within_limit';
}

export function remainingDays(totalDays: number): number {
  return PARTICIPATION_DAY_THRESHOLD - totalDays;
}

export function isParticipationFlagged(status: ParticipationThresholdStatus): boolean {
  return status === 'threshold_reached' || status === 'exceeded';
}

export function isNearLimit(totalDays: number): boolean {
  const left = remainingDays(totalDays);
  return totalDays < PARTICIPATION_DAY_THRESHOLD && left >= 0 && left <= NEAR_LIMIT_REMAINING;
}

/** 120–149 inclusive while still within the annual limit. */
export function isEarlyWarning(totalDays: number): boolean {
  return totalDays >= ANNUAL_EARLY_WARNING_THRESHOLD && totalDays < PARTICIPATION_DAY_THRESHOLD;
}

export function annualWarningStatus(totalDays: number): AnnualWarningStatus {
  if (totalDays > PARTICIPATION_DAY_THRESHOLD) return 'exceeded';
  if (totalDays === PARTICIPATION_DAY_THRESHOLD) return 'threshold_reached';
  if (isEarlyWarning(totalDays)) return 'early_warning';
  return 'normal';
}
