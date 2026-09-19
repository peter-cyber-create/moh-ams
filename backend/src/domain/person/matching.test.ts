import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideParticipantIdentity } from './matching.js';

test('unique phone attaches; name-only never auto-merges', () => {
  assert.equal(
    decideParticipantIdentity({
      existingPersonId: null,
      phoneNormalized: '256700111111',
      emailNormalized: null,
      phoneMatchCount: 1,
      emailMatchCount: 0,
      sameNormalizedNameExists: true,
    }).kind,
    'attach_phone',
  );
  assert.equal(
    decideParticipantIdentity({
      existingPersonId: null,
      phoneNormalized: null,
      emailNormalized: null,
      phoneMatchCount: 0,
      emailMatchCount: 0,
      sameNormalizedNameExists: true,
    }).resolution,
    'needs_review',
  );
  assert.equal(
    decideParticipantIdentity({
      existingPersonId: null,
      phoneNormalized: '256700111111',
      emailNormalized: null,
      phoneMatchCount: 2,
      emailMatchCount: 0,
      sameNormalizedNameExists: false,
    }).identityStatus,
    'ambiguous',
  );
});
