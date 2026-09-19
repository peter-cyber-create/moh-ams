import { utcDayUtc } from './participation.js';

export type DateRange = {
  start: Date;
  end: Date;
};

/** Inclusive date ranges overlap when neither ends before the other starts. */
export function dateRangesOverlap(a: DateRange, b: DateRange): boolean {
  return utcDayUtc(a.start) <= utcDayUtc(b.end) && utcDayUtc(b.start) <= utcDayUtc(a.end);
}

export function overlapPeriod(a: DateRange, b: DateRange): DateRange | null {
  if (!dateRangesOverlap(a, b)) return null;
  const start = utcDayUtc(a.start) >= utcDayUtc(b.start) ? a.start : b.start;
  const end = utcDayUtc(a.end) <= utcDayUtc(b.end) ? a.end : b.end;
  return { start, end };
}

export type OverlapCandidate = {
  activityId: string;
  title: string;
  referenceNumber: string | null;
  start: Date;
  end: Date;
  personId: string | null;
  personName: string;
  normalizedName?: string;
};

export type PersonOverlap = {
  personId: string;
  personName: string;
  activityAId: string;
  activityATitle: string;
  activityBId: string;
  activityBTitle: string;
  overlapStart: Date;
  overlapEnd: Date;
  kind: 'OVERLAP_DETECTED';
};

export type PotentialOverlap = {
  name: string;
  normalizedName: string;
  activityAId: string;
  activityATitle: string;
  activityBId: string;
  activityBTitle: string;
  overlapStart: Date;
  overlapEnd: Date;
  kind: 'POTENTIAL_PARTICIPANT_OVERLAP';
};

/**
 * Confirmed overlaps: same personId, overlapping date ranges, different activities.
 * Does not merge name-only identities.
 */
export function findConfirmedOverlaps(rows: OverlapCandidate[]): PersonOverlap[] {
  const withDates = rows.filter((r) => r.personId && r.start && r.end);
  const out: PersonOverlap[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i];
      const b = withDates[j];
      if (a.personId !== b.personId) continue;
      if (a.activityId === b.activityId) continue;
      const period = overlapPeriod({ start: a.start, end: a.end }, { start: b.start, end: b.end });
      if (!period) continue;
      const key = [a.personId, [a.activityId, b.activityId].sort().join(':')].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        personId: a.personId as string,
        personName: a.personName,
        activityAId: a.activityId,
        activityATitle: a.title,
        activityBId: b.activityId,
        activityBTitle: b.title,
        overlapStart: period.start,
        overlapEnd: period.end,
        kind: 'OVERLAP_DETECTED',
      });
    }
  }
  return out;
}

/**
 * Name-only / unresolved: same normalized name, no personId on at least one side,
 * overlapping dates. Never treated as the same Person.
 */
export function findPotentialNameOverlaps(rows: OverlapCandidate[]): PotentialOverlap[] {
  const withDates = rows.filter((r) => r.start && r.end && r.normalizedName);
  const out: PotentialOverlap[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i];
      const b = withDates[j];
      if (a.activityId === b.activityId) continue;
      if (a.normalizedName !== b.normalizedName) continue;
      if (a.personId && b.personId && a.personId === b.personId) continue;
      if (a.personId && b.personId) continue;
      const period = overlapPeriod({ start: a.start, end: a.end }, { start: b.start, end: b.end });
      if (!period) continue;
      const key = [a.normalizedName, [a.activityId, b.activityId].sort().join(':')].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: a.personName,
        normalizedName: a.normalizedName as string,
        activityAId: a.activityId,
        activityATitle: a.title,
        activityBId: b.activityId,
        activityBTitle: b.title,
        overlapStart: period.start,
        overlapEnd: period.end,
        kind: 'POTENTIAL_PARTICIPANT_OVERLAP',
      });
    }
  }
  return out;
}
