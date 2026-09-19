import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyParticipantImport, rowFromSpreadsheet } from './import-participants.js';

test('import classifies valid, invalid, duplicate and missing-identity rows without silent skip', () => {
  const rows = [
    rowFromSpreadsheet({ Name: 'Jane', Phone: '0700111111', Amount: 10 }),
    rowFromSpreadsheet({ name: '', phone: '0700222222' }),
    rowFromSpreadsheet({ Name: 'Jane', phone: '0700111111' }),
    rowFromSpreadsheet({ Name: 'Sam' }),
    'not-a-row',
  ];
  const result = classifyParticipantImport(rows as unknown[]);
  assert.equal(result.total, 5);
  assert.equal(result.valid.length, 2);
  assert.equal(result.invalid.length, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.missingIdentity.length, 1);
  assert.equal(result.rejected.length, 3);
  assert.equal(result.valid[0].name, 'Jane');
  assert.equal(result.valid[1].name, 'Sam');
});
