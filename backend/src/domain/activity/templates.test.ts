import { test } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {
  TEMPLATE_CATALOG,
  buildParticipantTemplateBuffer,
  missingParticipantColumns,
} from './templates.js';
import { classifyParticipantImport, rowFromSpreadsheet } from './import-participants.js';

test('participant template workbook is simple and catalog has participants only', () => {
  assert.equal(TEMPLATE_CATALOG.length, 1);
  assert.equal(TEMPLATE_CATALOG[0].id, 'participants');
  const buf = buildParticipantTemplateBuffer();
  const wb = XLSX.read(buf, { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('Participants'));
  assert.ok(wb.SheetNames.includes('Instructions'));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Participants, { defval: '' });
  assert.ok(rows.length >= 1);
  assert.ok('Name' in rows[0] || 'name' in rows[0]);
  assert.equal(missingParticipantColumns(Object.keys(rows[0])), null);
  const mapped = rowFromSpreadsheet(rows[0]);
  assert.ok(String(mapped.name).length > 0);
});

test('participant import rejects missing name column and invalid amount/phone', () => {
  const noName = classifyParticipantImport([{ phone: '0700111111' }], ['phone', 'amount']);
  assert.ok(noName.headerError);
  assert.equal(noName.valid.length, 0);

  const bad = classifyParticipantImport(
    [
      rowFromSpreadsheet({ name: 'Jane', phone: '12', amount: 'abc' }),
      rowFromSpreadsheet({ Name: 'Ok', Title: 'Nurse', Organisation: 'MoH', Phone: '0700111111', Amount: 10 }),
    ],
    ['name', 'phone', 'amount'],
  );
  assert.equal(bad.valid.length, 1);
  assert.equal(bad.invalid.length, 1);
  assert.match(String(bad.valid[0].title), /Nurse/);
});
