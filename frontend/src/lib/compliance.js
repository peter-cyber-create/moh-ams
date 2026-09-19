export const COMPLIANCE_API = '/api/v1/compliance';

export function complianceQuery(params) {
  const q = {};
  if (params.year) q.year = params.year;
  if (params.month) q.month = params.month;
  if (params.search) q.search = params.search;
  if (params.department) q.department = params.department;
  if (params.tab === 'participation' && params.exceeded) q.exceeded = true;
  if (params.exceeded) q.exceeded = true;
  if (params.overdue) q.overdue = true;
  if (params.earlyWarning) q.earlyWarning = true;
  if (params.monthlyExceeded) q.monthlyExceeded = true;
  if (params.monthlyLimit) q.monthlyLimit = true;
  if (params.overlap) q.overlap = true;
  if (params.page) q.page = params.page;
  if (params.participationStatus) q.participationStatus = params.participationStatus;
  if (params.accountabilityStatus) q.accountabilityStatus = params.accountabilityStatus;
  return q;
}

export function emptyComplianceCopy(tab) {
  if (tab === 'participation') return 'No participation records for this year.';
  if (tab === 'accountabilities') return 'No pending or overdue accountabilities.';
  if (tab === 'quality') return 'No data-quality issues in the current sample.';
  if (tab === 'monthly') return 'No monthly participation issues for this month.';
  if (tab === 'overlaps') return 'No overlapping activities detected.';
  return 'No compliance items match these filters.';
}

export function flagTone(label) {
  if (label === 'CLEAR') return 'ok';
  if (label === 'NEAR LIMIT' || label === 'EARLY WARNING') return 'info';
  return 'warn';
}
