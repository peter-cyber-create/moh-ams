/** Wave 5 monthly field-day policy. Not a rule engine. */
export const MONTHLY_FIELD_DAY_LIMIT = 20;

export type MonthlyThresholdStatus = 'within_limit' | 'limit_reached' | 'exceeded';

export function monthlyStatus(totalDays: number): MonthlyThresholdStatus {
  if (totalDays > MONTHLY_FIELD_DAY_LIMIT) return 'exceeded';
  if (totalDays === MONTHLY_FIELD_DAY_LIMIT) return 'limit_reached';
  return 'within_limit';
}

export function monthlyRemaining(totalDays: number): number {
  return MONTHLY_FIELD_DAY_LIMIT - totalDays;
}

export function isMonthlyFlagged(status: MonthlyThresholdStatus): boolean {
  return status === 'limit_reached' || status === 'exceeded';
}

/** Attribute participation to the activity start month (Wave 3 start-year style). */
export function activityMonthKey(activityDate: Date | null): { year: number; month: number } | null {
  if (!activityDate) return null;
  return { year: activityDate.getUTCFullYear(), month: activityDate.getUTCMonth() + 1 };
}

export function monthLabel(year: number, month: number): string {
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[month - 1] || `M${month}`} ${year}`;
}
