import XLSX from 'xlsx';

/**
 * Participant List template — the only spreadsheet used in Activity registration.
 * Columns match the importer (case-insensitive). `days` is accepted as legacy but not on the template.
 */
export const PARTICIPANT_TEMPLATE = {
  sheetName: 'Participants',
  fileName: 'AMS_Participant_List_Template.xlsx',
  columns: [
    { header: 'Name', required: true, note: 'Required. Full name of the participant.' },
    { header: 'Title', required: false, note: 'Optional. Job title.' },
    { header: 'Organisation', required: false, note: 'Optional. Organisation / workplace.' },
    { header: 'Phone', required: false, note: 'Optional but recommended. Phone or identifier (also accepts identifier / mobile / tel). Prefer a phone for person identity.' },
    { header: 'Amount', required: false, note: 'Optional. Numeric amount for this participant.' },
  ],
  sample: [
    {
      Name: 'Jane Doe',
      Title: 'District Health Officer',
      Organisation: 'Ministry of Health',
      Phone: '0700111111',
      Amount: 150000,
    },
    {
      Name: 'John Okello',
      Title: 'Nurse',
      Organisation: 'District Hospital',
      Phone: '0700222222',
      Amount: 120000,
    },
  ],
};

export type TemplateMeta = {
  id: 'participants';
  name: string;
  purpose: string;
  fileType: string;
  downloadPath: string;
};

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: 'participants',
    name: 'Participant List',
    purpose: 'Prepare participants for an Activity upload.',
    fileType: '.xlsx',
    downloadPath: '/api/v1/activities/templates/participants',
  },
];

function buildInstructionsSheet() {
  const rows = [
    ['AMS Participant List Template'],
    [],
    ['What this is for'],
    ['Upload participants for one Activity in AMS. Activity information is entered in the AMS form, not in this file.'],
    [],
    ['How to use'],
    ['1. Download this template'],
    ['2. Fill the Participants sheet'],
    ['3. Save as .xlsx'],
    ['4. In AMS: New Activity → Participants → Upload Participant List'],
    ['5. AMS validates the file'],
    ['6. Invalid / duplicate rows are reported (nothing is silently dropped)'],
    ['7. Valid rows become ActivityParticipants when you save or submit'],
    [],
    ['Column', 'Required', 'Notes'],
    ...PARTICIPANT_TEMPLATE.columns.map((c) => [c.header, c.required ? 'Yes' : 'No', c.note]),
    [],
    ['Phone format'],
    ['Use a local Uganda mobile where possible (e.g. 07XXXXXXXX). Digits only are fine.'],
    [],
    ['Identity'],
    ['Phone helps AMS link the row to a Person. Name-only rows are allowed but flagged for review.'],
    [],
    ['Duplicates'],
    ['Duplicate name+phone (or name-only) rows in the same file are rejected.'],
    [],
    ['Field days'],
    ['Do not calculate field days yourself. AMS uses Activity start and end dates (inclusive calendar days).'],
    ['A legacy "days" column is still accepted by the importer if present, but is not used for compliance when dates exist.'],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

export function buildParticipantTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const headers = PARTICIPANT_TEMPLATE.columns.map((c) => c.header);
  const data = [
    headers,
    ...PARTICIPANT_TEMPLATE.sample.map((row) => headers.map((h) => (row as Record<string, unknown>)[h] ?? '')),
    // empty rows for data entry
    ...Array.from({ length: 8 }, () => headers.map(() => '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, sheet, PARTICIPANT_TEMPLATE.sheetName);
  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), 'Instructions');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** @deprecated Activity details are entered in the AMS form. Kept only for regression tests of legacy parse helpers. */
export const ACTIVITY_DETAILS_TEMPLATE = {
  sheetName: 'Activity Details',
  fileName: 'AMS_Activity_Details_Template.xlsx',
  columns: [] as { header: string; required: boolean; note: string }[],
};

export function normalizeHeaderKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const keyed: Record<string, unknown> = {};
  Object.keys(raw || {}).forEach((key) => {
    keyed[key.trim().toLowerCase()] = raw[key];
  });
  return keyed;
}

export function cellValue(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

export function missingParticipantColumns(headerKeys: string[]): string | null {
  const lower = headerKeys.map((k) => String(k).trim().toLowerCase());
  const hasName = lower.some((k) => k === 'name' || k === 'participant' || k === 'full name');
  if (!hasName) return 'Missing required column: name (also accepts participant / full name).';
  return null;
}
