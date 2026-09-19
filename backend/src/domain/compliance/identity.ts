export type IdentityKind = 'phone' | 'name';
export type IdentityQuality = 'phone' | 'name_only' | 'duplicate_identity_candidate';

export function normalizeName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Digits only. Uganda local 0XXXXXXXXX → 256XXXXXXXXX. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('256') && digits.length >= 12) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `256${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `256${digits}`;
  return digits;
}

export function participantIdentity(name: string, phone?: string | null): {
  key: string;
  kind: IdentityKind;
  normalizedName: string;
  normalizedPhone: string | null;
} {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    return { key: `phone:${normalizedPhone}`, kind: 'phone', normalizedName, normalizedPhone };
  }
  return { key: `name:${normalizedName}`, kind: 'name', normalizedName, normalizedPhone: null };
}

export function markIdentityQuality(
  rows: { key: string; kind: IdentityKind; normalizedName: string }[],
): Map<string, IdentityQuality> {
  const namesWithPhone = new Set(rows.filter((r) => r.kind === 'phone').map((r) => r.normalizedName));
  const quality = new Map<string, IdentityQuality>();
  for (const row of rows) {
    if (row.kind === 'phone') {
      quality.set(row.key, 'phone');
      continue;
    }
    quality.set(row.key, namesWithPhone.has(row.normalizedName) ? 'duplicate_identity_candidate' : 'name_only');
  }
  return quality;
}
