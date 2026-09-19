import type { ParticipationThresholdStatus } from './participation.js';
import type { MonthlyThresholdStatus } from './monthly.js';

export type ComplianceFlag =
  | 'CLEAR'
  | 'NEAR_LIMIT'
  | 'EARLY_WARNING'
  | 'THRESHOLD_REACHED'
  | 'PARTICIPATION_EXCEEDED'
  | 'MONTHLY_LIMIT_REACHED'
  | 'MONTHLY_LIMIT_EXCEEDED'
  | 'OVERLAP_DETECTED'
  | 'POTENTIAL_PARTICIPANT_OVERLAP'
  | 'ACCOUNTABILITY_PENDING'
  | 'ACCOUNTABILITY_OVERDUE'
  | 'MULTIPLE_ISSUES';

export type OverallComplianceStatus = 'CLEAR' | 'NEAR_LIMIT' | 'EARLY_WARNING' | 'ACTION_REQUIRED' | 'NON_COMPLIANT';

export function participationFlags(
  status: ParticipationThresholdStatus,
  nearLimit: boolean,
  earlyWarning = false,
): ComplianceFlag[] {
  if (status === 'exceeded') return ['PARTICIPATION_EXCEEDED'];
  if (status === 'threshold_reached') return ['THRESHOLD_REACHED'];
  const flags: ComplianceFlag[] = [];
  if (earlyWarning) flags.push('EARLY_WARNING');
  if (nearLimit) flags.push('NEAR_LIMIT');
  return flags;
}

export function monthlyFlags(status: MonthlyThresholdStatus): ComplianceFlag[] {
  if (status === 'exceeded') return ['MONTHLY_LIMIT_EXCEEDED'];
  if (status === 'limit_reached') return ['MONTHLY_LIMIT_REACHED'];
  return [];
}

export function accountabilityFlags(pending: number, overdue: number): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  if (overdue > 0) flags.push('ACCOUNTABILITY_OVERDUE');
  if (pending > 0) flags.push('ACCOUNTABILITY_PENDING');
  return flags;
}

export function overallStatus(flags: ComplianceFlag[]): OverallComplianceStatus {
  const unique = [...new Set(flags.filter((f) => f !== 'CLEAR'))];
  if (unique.length === 0) return 'CLEAR';
  if (unique.length > 1) return 'NON_COMPLIANT';
  if (unique[0] === 'NEAR_LIMIT') return 'NEAR_LIMIT';
  if (unique[0] === 'EARLY_WARNING') return 'EARLY_WARNING';
  if (
    unique[0] === 'THRESHOLD_REACHED' ||
    unique[0] === 'PARTICIPATION_EXCEEDED' ||
    unique[0] === 'MONTHLY_LIMIT_EXCEEDED'
  ) {
    return 'NON_COMPLIANT';
  }
  return 'ACTION_REQUIRED';
}

export function displayOverall(flags: ComplianceFlag[]): { overall: OverallComplianceStatus; label: string } {
  const unique = [...new Set(flags.filter((f) => f !== 'CLEAR'))];
  if (unique.length === 0) return { overall: 'CLEAR', label: 'CLEAR' };
  if (unique.length > 1) return { overall: 'NON_COMPLIANT', label: 'MULTIPLE ISSUES' };
  const map: Record<string, { overall: OverallComplianceStatus; label: string }> = {
    PARTICIPATION_EXCEEDED: { overall: 'NON_COMPLIANT', label: 'PARTICIPATION EXCEEDED' },
    THRESHOLD_REACHED: { overall: 'NON_COMPLIANT', label: 'THRESHOLD REACHED' },
    MONTHLY_LIMIT_EXCEEDED: { overall: 'NON_COMPLIANT', label: 'MONTHLY LIMIT EXCEEDED' },
    MONTHLY_LIMIT_REACHED: { overall: 'ACTION_REQUIRED', label: 'MONTHLY LIMIT REACHED' },
    ACCOUNTABILITY_OVERDUE: { overall: 'ACTION_REQUIRED', label: 'ACCOUNTABILITY OVERDUE' },
    ACCOUNTABILITY_PENDING: { overall: 'ACTION_REQUIRED', label: 'ACCOUNTABILITY PENDING' },
    OVERLAP_DETECTED: { overall: 'ACTION_REQUIRED', label: 'OVERLAP REVIEW' },
    POTENTIAL_PARTICIPANT_OVERLAP: { overall: 'ACTION_REQUIRED', label: 'IDENTITY REVIEW' },
    EARLY_WARNING: { overall: 'EARLY_WARNING', label: 'EARLY WARNING' },
    NEAR_LIMIT: { overall: 'NEAR_LIMIT', label: 'NEAR LIMIT' },
  };
  return map[unique[0]] || { overall: 'ACTION_REQUIRED', label: unique[0].replace(/_/g, ' ') };
}

export function warningMessages(input: {
  name: string;
  year: number;
  monthLabel?: string;
  annualDays?: number;
  monthlyStatus?: MonthlyThresholdStatus;
  earlyWarning?: boolean;
  thresholdStatus?: ParticipationThresholdStatus;
  overlap?: boolean;
  pending?: boolean;
  overdue?: boolean;
}): string[] {
  const messages: string[] = [];
  const name = input.name || 'This person';
  if (input.thresholdStatus === 'exceeded') {
    messages.push(`${name} has exceeded the 150-day annual field-day limit.`);
  } else if (input.thresholdStatus === 'threshold_reached') {
    messages.push(`${name} has reached the 150-day annual field-day limit.`);
  } else if (input.earlyWarning) {
    messages.push(
      `${name} has reached ${input.annualDays ?? 120} field days in ${input.year} and is approaching the annual 150-day limit.`,
    );
  }
  if (input.monthlyStatus === 'exceeded' && input.monthLabel) {
    messages.push(`${name} has exceeded the 20-day field limit for ${input.monthLabel}.`);
  } else if (input.monthlyStatus === 'limit_reached' && input.monthLabel) {
    messages.push(`${name} has reached the 20-day field limit for ${input.monthLabel}.`);
  }
  if (input.overlap) {
    messages.push(`${name} is already assigned to another activity during part of this period.`);
  }
  if (input.overdue) messages.push(`${name} has an overdue accountability.`);
  else if (input.pending) messages.push(`${name} has a pending accountability.`);
  return messages;
}
