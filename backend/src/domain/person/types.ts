export type PersonIdentityStatus = 'confirmed' | 'unverified' | 'ambiguous' | 'needs_review';

export type PersonRecord = {
  id: string;
  personReference: string;
  fullName: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  organisation: string | null;
  title: string | null;
  departmentId: string | null;
  departmentName: string | null;
  identityStatus: PersonIdentityStatus;
  identityUserId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonEventRow = {
  id: string;
  personId: string;
  action: string;
  summary: string | null;
  meta: unknown;
  actorUserId: string | null;
  createdAt: Date;
};

export function formatPersonReference(seq: number): string {
  return `PER-${String(seq).padStart(6, '0')}`;
}
