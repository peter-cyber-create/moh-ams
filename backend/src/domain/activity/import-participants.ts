import { normalizePhone, participantIdentity } from '../compliance/identity.js';
import type { ParticipantInput, ParticipantRecord } from './participants.js';
import { missingParticipantColumns } from './templates.js';

export type ImportIssue = { row: number; reason: string; name?: string };

export type ImportClassification = {
  total: number;
  valid: ParticipantRecord[];
  rejected: ImportIssue[];
  duplicates: ImportIssue[];
  missingIdentity: ImportIssue[];
  invalid: ImportIssue[];
  headerError?: string | null;
};

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

export function rowFromSpreadsheet(raw: Record<string, unknown>): ParticipantInput {
  const keyed: Record<string, unknown> = {};
  Object.keys(raw || {}).forEach((key) => {
    keyed[key.trim().toLowerCase()] = raw[key];
  });
  const phone = cell(keyed, 'phone', 'identifier', 'mobile', 'tel');
  const titleOnly = cell(keyed, 'title');
  const org = cell(keyed, 'organisation', 'organization', 'org');
  let title = '';
  if (titleOnly && org) title = `${String(titleOnly).trim()} (${String(org).trim()})`;
  else title = String(titleOnly || org || '').trim();
  return {
    name: cell(keyed, 'name', 'participant', 'full name'),
    title,
    phone,
    amount: cell(keyed, 'amount', 'amt'),
    days: cell(keyed, 'days'),
  };
}

function parseOptionalNumber(raw: unknown, label: string): { ok: true; value: number } | { ok: false; reason: string } {
  if (raw == null || String(raw).trim() === '') return { ok: true, value: 0 };
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: `${label} must be a non-negative number.` };
  return { ok: true, value: n };
}

function phoneLooksInvalid(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return true;
  return normalizePhone(phone) == null;
}

/**
 * Classify participant rows. Pass original spreadsheet header keys to reject missing columns
 * before any silent empty-name failures.
 */
export function classifyParticipantImport(rows: unknown[], headerKeys?: string[]): ImportClassification {
  const valid: ParticipantRecord[] = [];
  const rejected: ImportIssue[] = [];
  const duplicates: ImportIssue[] = [];
  const missingIdentity: ImportIssue[] = [];
  const invalid: ImportIssue[] = [];
  const seen = new Set<string>();

  const headerError = headerKeys ? missingParticipantColumns(headerKeys) : null;
  if (headerError) {
    const issue = { row: 0, reason: headerError };
    return {
      total: rows.length,
      valid: [],
      rejected: [issue],
      duplicates: [],
      missingIdentity: [],
      invalid: [issue],
      headerError,
    };
  }

  rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    if (!raw || typeof raw !== 'object') {
      const issue = { row: rowNumber, reason: 'Row is not an object.' };
      invalid.push(issue);
      rejected.push(issue);
      return;
    }
    const input = raw as ParticipantInput;
    const name = String(input.name ?? '').trim();
    if (!name) {
      const issue = { row: rowNumber, reason: 'Participant name is required.' };
      invalid.push(issue);
      rejected.push(issue);
      return;
    }
    const phone = input.phone != null ? String(input.phone).trim() : '';
    if (phoneLooksInvalid(phone)) {
      const issue = { row: rowNumber, reason: 'Phone/identifier is invalid.', name };
      invalid.push(issue);
      rejected.push(issue);
      return;
    }
    const amountParsed = parseOptionalNumber(input.amount, 'Amount');
    if (!amountParsed.ok) {
      const issue = { row: rowNumber, reason: amountParsed.reason, name };
      invalid.push(issue);
      rejected.push(issue);
      return;
    }
    const daysParsed = parseOptionalNumber(input.days, 'Days');
    if (!daysParsed.ok) {
      const issue = { row: rowNumber, reason: daysParsed.reason, name };
      invalid.push(issue);
      rejected.push(issue);
      return;
    }
    const record: ParticipantRecord = {
      name,
      title: input.title != null ? String(input.title).trim() : '',
      phone,
      amount: amountParsed.value,
      days: daysParsed.value,
    };
    const identity = participantIdentity(record.name, record.phone);
    if (seen.has(identity.key)) {
      const issue = { row: rowNumber, reason: 'Duplicate participant in this file.', name };
      duplicates.push(issue);
      rejected.push(issue);
      return;
    }
    seen.add(identity.key);
    if (identity.kind === 'name') {
      missingIdentity.push({ row: rowNumber, reason: 'No phone/identifier; name-only identity.', name });
    }
    valid.push(record);
  });

  return {
    total: rows.length,
    valid,
    rejected,
    duplicates,
    missingIdentity,
    invalid,
    headerError: null,
  };
}

export function importSummary(c: ImportClassification) {
  return {
    total: c.total,
    valid: c.valid.length,
    invalid: c.invalid.length,
    duplicates: c.duplicates.length,
    imported: c.valid.length,
    rejected: c.rejected.length,
    missingIdentity: c.missingIdentity.length,
    reasons: c.rejected,
    warnings: c.missingIdentity,
    rows: c.valid,
  };
}
