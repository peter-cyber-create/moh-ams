/** Shared helpers for single and multiple activity registration (UX only). */

export const REGISTER_STEPS = ['Activity', 'Participants', 'Check & Submit'];

export const FUNDERS = [
  'GOU',
  'GF-HIV',
  'GF-COVID',
  'GF-MALARIA',
  'GF-TB',
  'GF-RSSH',
  'GF-COORDINATION',
  'UCREPP',
  'GAVI',
  'ISHSP',
  'CDC',
  'WHO',
];

export const emptyActivityForm = () => ({
  activityName: '',
  requestedBy: '',
  dept: '',
  location: '',
  invoiceDate: '',
  endDate: '',
  vocherno: '',
  amt: '',
  funder: '',
  description: '',
});

export function validateActivityForm(form) {
  if (!form.activityName?.trim()) return 'Activity name is required.';
  if (!form.requestedBy?.trim()) return 'Requested by is required.';
  if (!form.dept?.trim()) return 'Department is required.';
  if (!form.invoiceDate) return 'Start date is required.';
  if (!form.amt) return 'Amount is required.';
  if (!form.funder) return 'Funding source is required.';
  if (form.endDate && form.invoiceDate && form.endDate < form.invoiceDate) {
    return 'End date must not be before start date.';
  }
  return '';
}

export function activityPayloadFromForm(form, status, participants) {
  const notes = form.description?.trim();
  const baseDesc = `Requested by: ${form.requestedBy} (${form.dept})${form.location ? ` · ${form.location}` : ''}`;
  return {
    title: form.activityName.trim() || (status === 'draft' ? 'Untitled draft' : form.activityName.trim()),
    description: notes ? `${baseDesc}. ${notes}` : baseDesc,
    requestedBy: form.requestedBy.trim() || undefined,
    location: form.location.trim() || undefined,
    departmentName: form.dept.trim() || undefined,
    amount: Number(String(form.amt).replace(/,/g, '')) || 0,
    invoiceDate: form.invoiceDate || undefined,
    endDate: form.endDate || undefined,
    voucherNumber: form.vocherno.trim() || undefined,
    funder: form.funder || undefined,
    status,
    participants,
  };
}

export function newMultiActivitySlot(index = 0) {
  return {
    key: `a-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    form: emptyActivityForm(),
    rows: [],
    importSummary: null,
    open: true,
    selected: true,
    check: null,
  };
}

/** Compact status for batch check summary. */
export function summarizePreview(preview) {
  if (!preview) return { level: 'unknown', label: 'Not checked' };
  const s = preview.summary || {};
  const exceeded = Number(s.exceeded || 0);
  const threshold = Number(s.thresholdReached || 0);
  const monthly = Number(s.monthlyExceeded || 0) + Number(s.monthlyLimitReached || 0);
  const early = Number(s.earlyWarning || 0);
  const overlaps = Number(s.overlaps || 0) + Number(s.potentialOverlaps || 0);
  const overdue = Number(s.overdueAccountability || 0);
  const pending = Number(s.pendingAccountability || 0);
  if (exceeded > 0) {
    return { level: 'alert', label: `${exceeded} participant(s) exceed 150 field days` };
  }
  if (threshold > 0 || monthly > 0 || overlaps > 0 || overdue > 0) {
    const parts = [];
    if (threshold) parts.push(`${threshold} at 150 days`);
    if (monthly) parts.push(`${monthly} monthly limit`);
    if (overlaps) parts.push(`${overlaps} overlap(s)`);
    if (overdue) parts.push(`${overdue} overdue accountability`);
    return { level: 'warn', label: parts.join(' · ') || 'Review required' };
  }
  if (early > 0 || pending > 0) {
    const parts = [];
    if (early) parts.push(`${early} early warning (120+)`);
    if (pending) parts.push(`${pending} pending accountability`);
    return { level: 'warn', label: parts.join(' · ') };
  }
  return { level: 'ok', label: 'No major issues' };
}
