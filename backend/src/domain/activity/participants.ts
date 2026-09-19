export type ParticipantInput = {
  name?: unknown;
  title?: unknown;
  phone?: unknown;
  amount?: unknown;
  days?: unknown;
};

export type ParticipantRecord = {
  name: string;
  title: string;
  phone: string;
  amount: number;
  days: number;
  personId?: string | null;
};

export function sanitizeParticipants(input: unknown): ParticipantRecord[] {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new Error('Participants must be a list.');
  }
  return input.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`Participant ${index + 1} is invalid.`);
    }
    const p = row as ParticipantInput;
    const name = String(p.name ?? '').trim();
    if (!name) {
      throw new Error(`Participant ${index + 1} needs a name.`);
    }
    return {
      name,
      title: p.title != null ? String(p.title) : '',
      phone: p.phone != null ? String(p.phone) : '',
      amount: Number(p.amount) || 0,
      days: Number(p.days) || 0,
      personId: 'personId' in p && p.personId ? String(p.personId) : null,
    };
  });
}

export function personKey(name: string, phone: string): string {
  return `${phone || ''}|${name || ''}`.toLowerCase();
}

export const FLAG_DAY_THRESHOLD = 150;

export function aggregateParticipantsByPerson(
  rows: { name: string; title?: string | null; phone?: string | null; days?: number; amount?: number; personId?: string | null }[],
) {
  const map = new Map<
    string,
    { name: string; title?: string; phone?: string; personId?: string; totalDays: number; totalAmount: number }
  >();
  for (const p of rows) {
    if (!p.name && !p.phone && !p.personId) continue;
    const key = p.personId || personKey(p.name || '', p.phone || '');
    const current = map.get(key) ?? {
      name: p.name || '',
      title: p.title ?? undefined,
      phone: p.phone ?? undefined,
      personId: p.personId ?? undefined,
      totalDays: 0,
      totalAmount: 0,
    };
    current.totalDays += Number(p.days) || 0;
    current.totalAmount += Number(p.amount) || 0;
    map.set(key, current);
  }
  return Array.from(map.values());
}

export function flaggedParticipants(
  rows: { name: string; title?: string | null; phone?: string | null; days?: number; amount?: number }[],
) {
  return aggregateParticipantsByPerson(rows).filter((u) => u.totalDays >= FLAG_DAY_THRESHOLD);
}
