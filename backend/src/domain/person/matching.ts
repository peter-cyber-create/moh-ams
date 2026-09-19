import { normalizeName, normalizePhone } from '../compliance/identity.js';
import type { PersonIdentityStatus } from './types.js';

export type PersonResolution = 'existing' | 'matched' | 'new' | 'ambiguous' | 'needs_review';

export type IdentityDecision = {
  kind: 'keep' | 'attach_phone' | 'attach_email' | 'create';
  identityStatus: PersonIdentityStatus;
  resolution: PersonResolution;
};

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

export function decideParticipantIdentity(input: {
  existingPersonId?: string | null;
  phoneNormalized: string | null;
  emailNormalized: string | null;
  phoneMatchCount: number;
  emailMatchCount: number;
  sameNormalizedNameExists: boolean;
}): IdentityDecision {
  if (input.existingPersonId) {
    return { kind: 'keep', identityStatus: 'confirmed', resolution: 'existing' };
  }
  if (input.phoneNormalized) {
    if (input.phoneMatchCount === 1) {
      return { kind: 'attach_phone', identityStatus: 'confirmed', resolution: 'matched' };
    }
    if (input.phoneMatchCount > 1) {
      return { kind: 'create', identityStatus: 'ambiguous', resolution: 'ambiguous' };
    }
    return { kind: 'create', identityStatus: 'confirmed', resolution: 'new' };
  }
  if (input.emailNormalized) {
    if (input.emailMatchCount === 1) {
      return { kind: 'attach_email', identityStatus: 'confirmed', resolution: 'matched' };
    }
    if (input.emailMatchCount > 1) {
      return { kind: 'create', identityStatus: 'ambiguous', resolution: 'ambiguous' };
    }
    return { kind: 'create', identityStatus: 'confirmed', resolution: 'new' };
  }
  if (input.sameNormalizedNameExists) {
    return { kind: 'create', identityStatus: 'needs_review', resolution: 'needs_review' };
  }
  return { kind: 'create', identityStatus: 'unverified', resolution: 'new' };
}

export function participantLookupKeys(name: string, phone?: string | null, email?: string | null) {
  return {
    normalizedName: normalizeName(name),
    phoneNormalized: normalizePhone(phone),
    emailNormalized: normalizeEmail(email),
  };
}
