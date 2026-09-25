import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { resolveUploadFile } from './local-file-store.js';

const root = path.resolve('/var/ams/uploads');

test('stored reports resolve inside the upload directory', () => {
  assert.equal(resolveUploadFile(root, '/reports/activity-report.pdf'), path.join(root, 'reports/activity-report.pdf'));
});

test('upload paths cannot leave the upload directory', () => {
  assert.equal(resolveUploadFile(root, '/../etc/passwd'), null);
  assert.equal(resolveUploadFile(root, '/reports/../../etc/passwd'), null);
  assert.equal(resolveUploadFile(root, '/%2e%2e/secret.pdf'), null);
});

test('only report document types are served', () => {
  assert.equal(resolveUploadFile(root, '/reports/notes.txt'), null);
});
