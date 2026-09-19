import { badRequest, forbidden, notFound } from '../../domain/activity/errors.js';
import type { Actor } from '../../domain/activity/permissions.js';
import {
  isClearedAccountability,
  isOverdueAccountability,
  isPendingAccountability,
  isRejectedAccountability,
  daysOutstanding,
} from '../../domain/compliance/accountability.js';
import {
  accountabilityFlags,
  displayOverall,
  monthlyFlags,
  participationFlags,
  warningMessages,
  type ComplianceFlag,
} from '../../domain/compliance/flags.js';
import { normalizeName, normalizePhone } from '../../domain/compliance/identity.js';
import {
  MONTHLY_FIELD_DAY_LIMIT,
  activityMonthKey,
  isMonthlyFlagged,
  monthLabel,
  monthlyRemaining,
  monthlyStatus,
} from '../../domain/compliance/monthly.js';
import {
  dateRangesOverlap,
  findConfirmedOverlaps,
  findPotentialNameOverlaps,
  overlapPeriod,
  type OverlapCandidate,
} from '../../domain/compliance/overlap.js';
import { canPreviewCompliance, canViewCompliance } from '../../domain/compliance/permissions.js';
import {
  ANNUAL_EARLY_WARNING_THRESHOLD,
  PARTICIPATION_DAY_THRESHOLD,
  activityDuration,
  annualWarningStatus,
  isEarlyWarning,
  isNearLimit,
  isParticipationEligibleStatus,
  remainingDays,
  thresholdStatus,
} from '../../domain/compliance/participation.js';
import type {
  AccountabilitySourceRow,
  ComplianceListFilters,
  CompliancePreviewInput,
  ComplianceReadPort,
  DirectoryPerson,
  IdentityPerson,
  ParticipationSourceRow,
  PreviewParticipantInput,
} from './ports.js';

export type ActivityContribution = {
  activityId: string;
  title: string;
  referenceNumber: string | null;
  startDate: Date | null;
  endDate: Date | null;
  days: number;
  status: string;
  issues: string[];
  provenance: string;
  crossYear: boolean;
  month?: number | null;
};

function yearBounds(year: number) {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function parsePreviewDate(raw: string | Date | null | undefined): Date | null {
  if (raw == null || raw === '') return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

export class ComplianceService {
  constructor(private readonly db: ComplianceReadPort) {}

  private requireView(actor: Actor) {
    if (!canViewCompliance(actor)) throw forbidden('You do not have access to compliance.');
  }

  private requirePreview(actor: Actor) {
    if (!canPreviewCompliance(actor)) throw forbidden('You do not have access to compliance preview.');
  }

  private buildMonthlyTotals(rows: ParticipationSourceRow[], year: number) {
    const map = new Map<string, Map<number, number>>();
    for (const r of rows) {
      if (!r.personId || !isParticipationEligibleStatus(r.activityStatus)) continue;
      const duration = activityDuration({
        activityDate: r.activityDate,
        endDate: r.endDate,
        days: r.activityDays,
      });
      if (duration.days == null || duration.year !== year) continue;
      const mk = activityMonthKey(r.activityDate);
      if (!mk) continue;
      const byMonth = map.get(r.personId) || new Map<number, number>();
      byMonth.set(mk.month, (byMonth.get(mk.month) || 0) + duration.days);
      map.set(r.personId, byMonth);
    }
    return map;
  }

  private buildParticipation(
    rows: ParticipationSourceRow[],
    year: number,
    people: Map<string, DirectoryPerson>,
    monthFilter?: number,
  ) {
    const eligible = rows.filter((r) => isParticipationEligibleStatus(r.activityStatus) && r.personId);
    const monthlyTotals = this.buildMonthlyTotals(rows, year);
    const map = new Map<
      string,
      {
        identityKey: string;
        personId: string;
        personReference: string | null;
        name: string;
        phone: string | null;
        title: string | null;
        departmentName: string | null;
        identityStatus: string;
        identityQuality: string;
        activities: ActivityContribution[];
        issues: string[];
      }
    >();

    for (const r of eligible) {
      const personId = r.personId as string;
      const directory = people.get(personId);
      const duration = activityDuration({
        activityDate: r.activityDate,
        endDate: r.endDate,
        days: r.activityDays,
      });
      const issues = [...duration.issues];
      if (duration.year != null && duration.year !== year) continue;
      if (duration.days == null) issues.push('excluded_from_total');
      const mk = activityMonthKey(r.activityDate);
      if (monthFilter && mk && mk.month !== monthFilter) {
        // Still count toward annual; monthly filter applied on the person roll-up below.
      }
      const current = map.get(personId) ?? {
        identityKey: personId,
        personId,
        personReference: directory?.personReference || null,
        name: directory?.fullName || r.name,
        phone: directory?.phone || r.phone,
        title: directory?.title || r.title,
        departmentName: directory?.departmentName || r.departmentName,
        identityStatus: directory?.identityStatus || 'unverified',
        identityQuality: directory?.identityStatus || 'unverified',
        activities: [],
        issues: [],
      };
      if (duration.days != null) {
        current.activities.push({
          activityId: r.activityId,
          title: r.activityTitle,
          referenceNumber: r.referenceNumber,
          startDate: r.activityDate,
          endDate: r.endDate ?? null,
          days: duration.days,
          status: r.activityStatus,
          issues,
          provenance: duration.provenance,
          crossYear: duration.crossYear,
          month: mk?.month ?? null,
        });
      }
      current.issues.push(
        ...issues.filter((i) => i !== 'duration_from_activity_days_snapshot' && i !== 'end_date_missing_counted_as_one_day'),
      );
      if (!current.departmentName && r.departmentName) current.departmentName = r.departmentName;
      map.set(personId, current);
    }

    return [...map.values()].map((p) => {
      const totalDays = p.activities.reduce((sum, a) => sum + a.days, 0);
      const status = thresholdStatus(totalDays);
      const remaining = remainingDays(totalDays);
      const near = isNearLimit(totalDays);
      const early = isEarlyWarning(totalDays);
      const flags = participationFlags(status, near, early);
      const months = monthlyTotals.get(p.personId) || new Map<number, number>();
      const monthEntries = [...months.entries()].map(([month, days]) => {
        const mStatus = monthlyStatus(days);
        return {
          year,
          month,
          label: monthLabel(year, month),
          totalDays: days,
          threshold: MONTHLY_FIELD_DAY_LIMIT,
          remaining: monthlyRemaining(days),
          status: mStatus,
          flagged: isMonthlyFlagged(mStatus),
          flags: monthlyFlags(mStatus),
        };
      });
      const focusMonth = monthFilter
        ? monthEntries.find((m) => m.month === monthFilter) || {
            year,
            month: monthFilter,
            label: monthLabel(year, monthFilter),
            totalDays: 0,
            threshold: MONTHLY_FIELD_DAY_LIMIT,
            remaining: MONTHLY_FIELD_DAY_LIMIT,
            status: 'within_limit' as const,
            flagged: false,
            flags: [] as ComplianceFlag[],
          }
        : monthEntries.sort((a, b) => b.totalDays - a.totalDays)[0] || null;
      const monthFlags = focusMonth ? monthlyFlags(focusMonth.status) : [];
      return {
        ...p,
        year,
        activityCount: p.activities.length,
        totalDays,
        threshold: PARTICIPATION_DAY_THRESHOLD,
        earlyWarningThreshold: ANNUAL_EARLY_WARNING_THRESHOLD,
        remaining,
        daysOver: totalDays > PARTICIPATION_DAY_THRESHOLD ? totalDays - PARTICIPATION_DAY_THRESHOLD : 0,
        participationStatus: status,
        annualWarning: annualWarningStatus(totalDays),
        nearLimit: near,
        earlyWarning: early,
        flagged: status !== 'within_limit',
        participationFlags: flags,
        months: monthEntries,
        monthly: focusMonth,
        monthlyFlags: monthFlags,
      };
    });
  }

  private buildAccountabilities(
    rows: AccountabilitySourceRow[],
    users: Map<string, IdentityPerson>,
    people: Map<string, DirectoryPerson>,
    now: Date,
  ) {
    return rows.map((r) => {
      const user = users.get(r.submittedById);
      const person = r.personId ? people.get(r.personId) : undefined;
      const overdue = isOverdueAccountability(r.status, r.dueDate, now);
      return {
        id: r.id,
        referenceNumber: r.referenceNumber,
        status: r.status,
        dueDate: r.dueDate,
        overdue,
        daysOutstanding: overdue ? daysOutstanding(r.dueDate, now) : null,
        activityId: r.activityId,
        activityTitle: r.activityTitle,
        submittedById: r.submittedById,
        submittedByName: user?.name || r.submittedById,
        personId: r.personId,
        pending: isPendingAccountability(r.status),
        cleared: isClearedAccountability(r.status),
        rejected: isRejectedAccountability(r.status),
        returned: r.status === 'returned',
        clarificationRequested: r.status === 'clarification_requested',
        departmentName: person?.departmentName || user?.departmentName || null,
      };
    });
  }

  private overlapCandidates(rows: ParticipationSourceRow[], people: Map<string, DirectoryPerson>): OverlapCandidate[] {
    const out: OverlapCandidate[] = [];
    for (const r of rows) {
      if (!isParticipationEligibleStatus(r.activityStatus)) continue;
      const duration = activityDuration({
        activityDate: r.activityDate,
        endDate: r.endDate,
        days: r.activityDays,
      });
      if (!r.activityDate || duration.days == null) continue;
      const end =
        r.endDate ||
        new Date(Date.UTC(r.activityDate.getUTCFullYear(), r.activityDate.getUTCMonth(), r.activityDate.getUTCDate() + duration.days - 1));
      out.push({
        activityId: r.activityId,
        title: r.activityTitle,
        referenceNumber: r.referenceNumber,
        start: r.activityDate,
        end,
        personId: r.personId,
        personName: (r.personId && people.get(r.personId)?.fullName) || r.name,
        normalizedName: normalizeName(r.name),
      });
    }
    return out;
  }

  private personRow(
    year: number,
    p: ReturnType<ComplianceService['buildParticipation']>[number] | null,
    accs: ReturnType<ComplianceService['buildAccountabilities']>,
    extra?: {
      name?: string;
      departmentName?: string | null;
      identityKey?: string;
      personId?: string | null;
      personReference?: string | null;
      overlapCount?: number;
      potentialOverlapCount?: number;
    },
  ) {
    const pending = accs.filter((a) => a.pending);
    const overdue = accs.filter((a) => a.overdue);
    const overlapCount = extra?.overlapCount || 0;
    const potentialOverlapCount = extra?.potentialOverlapCount || 0;
    const flags: ComplianceFlag[] = [
      ...(p ? p.participationFlags : []),
      ...(p ? p.monthlyFlags : []),
      ...accountabilityFlags(pending.length, overdue.length),
      ...(overlapCount > 0 ? (['OVERLAP_DETECTED'] as ComplianceFlag[]) : []),
      ...(potentialOverlapCount > 0 ? (['POTENTIAL_PARTICIPANT_OVERLAP'] as ComplianceFlag[]) : []),
    ];
    const overall = displayOverall(flags);
    const personId = p?.personId || extra?.personId || accs[0]?.personId || null;
    return {
      identityKey: p?.identityKey || extra?.identityKey || personId || `user:${accs[0]?.submittedById || 'unknown'}`,
      personId,
      personReference: p?.personReference || extra?.personReference || null,
      name: p?.name || extra?.name || accs[0]?.submittedByName || 'Unknown',
      phone: p?.phone || null,
      title: p?.title || null,
      departmentName: p?.departmentName || extra?.departmentName || accs[0]?.departmentName || null,
      year,
      totalDays: p?.totalDays ?? 0,
      threshold: PARTICIPATION_DAY_THRESHOLD,
      earlyWarningThreshold: ANNUAL_EARLY_WARNING_THRESHOLD,
      remaining: p?.remaining ?? PARTICIPATION_DAY_THRESHOLD,
      daysOver: p?.daysOver ?? 0,
      activityCount: p?.activityCount ?? 0,
      participationStatus: p?.participationStatus || 'within_limit',
      annualWarning: p?.annualWarning || 'normal',
      earlyWarning: p?.earlyWarning || false,
      nearLimit: p?.nearLimit || false,
      flagged: p ? p.participationStatus !== 'within_limit' : false,
      identityQuality: p?.identityQuality || 'unlinked_accountability',
      identityStatus: p?.identityStatus || 'unverified',
      monthly: p?.monthly || null,
      months: p?.months || [],
      monthlyFlags: p?.monthlyFlags || [],
      pendingCount: pending.length,
      overdueCount: overdue.length,
      returnedCount: accs.filter((a) => a.returned).length,
      clarificationCount: accs.filter((a) => a.clarificationRequested).length,
      overlapCount,
      potentialOverlapCount,
      flags,
      overall: overall.overall,
      overallLabel: overall.label,
      activities: p?.activities || [],
      accountabilities: accs,
    };
  }

  async overview(actor: Actor, filters: ComplianceListFilters = {}, now = new Date()) {
    this.requireView(actor);
    const year = filters.year || now.getUTCFullYear();
    const [pRows, aRows] = await Promise.all([this.db.participationRows(year), this.db.accountabilityRows()]);
    const personIds = [
      ...new Set([...pRows.map((r) => r.personId), ...aRows.map((r) => r.personId)].filter((id): id is string => !!id)),
    ];
    const userIds = [...new Set(aRows.map((a) => a.submittedById))];
    const [directory, users] = await Promise.all([this.db.directoryPeople(personIds), this.db.identityPeople(userIds)]);
    const peopleMap = new Map(directory.map((p) => [p.id, p]));
    const usersMap = new Map(users.map((p) => [p.id, p]));
    const participation = this.buildParticipation(pRows, year, peopleMap, filters.month);
    const accs = this.buildAccountabilities(aRows, usersMap, peopleMap, now);
    const candidates = this.overlapCandidates(pRows, peopleMap);
    const overlaps = findConfirmedOverlaps(candidates);
    const potential = findPotentialNameOverlaps(candidates);
    const overlapByPerson = new Map<string, number>();
    for (const o of overlaps) {
      overlapByPerson.set(o.personId, (overlapByPerson.get(o.personId) || 0) + 1);
    }

    const accByPerson = new Map<string, typeof accs>();
    const unlinked: typeof accs = [];
    for (const a of accs) {
      if (a.personId) {
        const list = accByPerson.get(a.personId) || [];
        list.push(a);
        accByPerson.set(a.personId, list);
      } else {
        unlinked.push(a);
      }
    }

    const participationIds = new Set(participation.map((p) => p.personId));
    let combined = [
      ...participation.map((p) =>
        this.personRow(year, p, accByPerson.get(p.personId) || [], {
          overlapCount: overlapByPerson.get(p.personId) || 0,
        }),
      ),
      ...this.groupUnlinked(
        [
          ...unlinked,
          ...[...accByPerson.entries()]
            .filter(([personId]) => !participationIds.has(personId))
            .flatMap(([, list]) => list),
        ],
        year,
        peopleMap,
      ),
    ];

    combined = this.applyFilters(combined, filters);
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const total = combined.length;
    const data = combined.slice((page - 1) * limit, page * limit);

    const pendingAccs = accs.filter((a) => a.pending);
    const overdueAccs = accs.filter((a) => a.overdue);
    return {
      year,
      month: filters.month || null,
      threshold: PARTICIPATION_DAY_THRESHOLD,
      earlyWarningThreshold: ANNUAL_EARLY_WARNING_THRESHOLD,
      monthlyThreshold: MONTHLY_FIELD_DAY_LIMIT,
      summary: {
        participationFlagged: participation.filter((p) => p.flagged).length,
        thresholdReached: participation.filter((p) => p.participationStatus === 'threshold_reached').length,
        exceeded: participation.filter((p) => p.participationStatus === 'exceeded').length,
        earlyWarning: participation.filter((p) => p.earlyWarning).length,
        monthlyExceeded: participation.filter((p) => p.monthly?.status === 'exceeded').length,
        monthlyLimitReached: participation.filter((p) => p.monthly?.status === 'limit_reached').length,
        pendingAccountabilities: pendingAccs.length,
        overdueAccountabilities: overdueAccs.length,
        overlaps: overlaps.length,
        potentialOverlaps: potential.length,
        actionRequired: combined.filter((r) => r.overall !== 'CLEAR').length,
      },
      total,
      page,
      limit,
      data,
    };
  }

  async participation(actor: Actor, filters: ComplianceListFilters = {}, now = new Date()) {
    const overview = await this.overview(actor, filters, now);
    return {
      ...overview,
      data: overview.data.filter((r) => r.activityCount > 0),
    };
  }

  async accountabilities(actor: Actor, filters: ComplianceListFilters = {}, now = new Date()) {
    this.requireView(actor);
    const year = filters.year || now.getUTCFullYear();
    const aRows = await this.db.accountabilityRows();
    const personIds = [...new Set(aRows.map((r) => r.personId).filter((id): id is string => !!id))];
    const userIds = [...new Set(aRows.map((a) => a.submittedById))];
    const [directory, users] = await Promise.all([this.db.directoryPeople(personIds), this.db.identityPeople(userIds)]);
    const peopleMap = new Map(directory.map((p) => [p.id, p]));
    const usersMap = new Map(users.map((p) => [p.id, p]));
    let accs = this.buildAccountabilities(aRows, usersMap, peopleMap, now).filter((a) => a.pending || a.overdue);
    if (filters.overdue) accs = accs.filter((a) => a.overdue);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      accs = accs.filter(
        (a) =>
          a.referenceNumber.toLowerCase().includes(q) ||
          a.submittedByName.toLowerCase().includes(q) ||
          a.activityTitle.toLowerCase().includes(q),
      );
    }
    if (filters.accountabilityStatus === 'returned') accs = accs.filter((a) => a.status === 'returned');
    if (filters.accountabilityStatus === 'clarification') accs = accs.filter((a) => a.status === 'clarification_requested');
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    return { year, total: accs.length, page, limit, data: accs.slice((page - 1) * limit, page * limit) };
  }

  async person(actor: Actor, identityKey: string, year?: number, now = new Date()) {
    const decoded = decodeURIComponent(identityKey);
    const result = await this.overview(actor, { year, page: 1, limit: 500 }, now);
    const found = result.data.find(
      (r) => r.identityKey === decoded || r.personId === decoded || r.personReference === decoded,
    );
    if (!found) throw notFound('Participant not found in this year');
    return found;
  }

  async monthly(actor: Actor, filters: ComplianceListFilters = {}, now = new Date()) {
    this.requireView(actor);
    const year = filters.year || now.getUTCFullYear();
    const month = filters.month || now.getUTCMonth() + 1;
    const overview = await this.overview(actor, { ...filters, year, month, page: 1, limit: 500 }, now);
    const data = overview.data
      .filter((r) => r.activityCount > 0)
      .map((r) => ({
        personId: r.personId,
        personReference: r.personReference,
        name: r.name,
        departmentName: r.departmentName,
        monthly: r.monthly,
        annualTotal: r.totalDays,
        annualStatus: r.participationStatus,
        earlyWarning: r.earlyWarning,
        flags: r.flags,
        overallLabel: r.overallLabel,
      }))
      .filter((r) => (filters.monthlyExceeded ? r.monthly?.status === 'exceeded' : true))
      .filter((r) => (filters.monthlyLimit ? r.monthly && r.monthly.status !== 'within_limit' : true));
    return {
      year,
      month,
      label: monthLabel(year, month),
      threshold: MONTHLY_FIELD_DAY_LIMIT,
      total: data.length,
      data,
    };
  }

  async overlaps(actor: Actor, filters: ComplianceListFilters = {}, now = new Date()) {
    this.requireView(actor);
    const year = filters.year || now.getUTCFullYear();
    const pRows = await this.db.participationRows(year);
    const personIds = [...new Set(pRows.map((r) => r.personId).filter((id): id is string => !!id))];
    const directory = await this.db.directoryPeople(personIds);
    const peopleMap = new Map(directory.map((p) => [p.id, p]));
    const candidates = this.overlapCandidates(pRows, peopleMap);
    const confirmed = findConfirmedOverlaps(candidates);
    const potential = findPotentialNameOverlaps(candidates);
    let data = [
      ...confirmed.map((o) => ({ ...o, year })),
      ...potential.map((o) => ({ ...o, year, personId: null as string | null })),
    ];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(
        (o) =>
          ('personName' in o && String(o.personName).toLowerCase().includes(q)) ||
          ('name' in o && String(o.name).toLowerCase().includes(q)) ||
          o.activityATitle.toLowerCase().includes(q) ||
          o.activityBTitle.toLowerCase().includes(q),
      );
    }
    return { year, total: data.length, confirmed: confirmed.length, potential: potential.length, data };
  }

  async annual(actor: Actor, filters: ComplianceListFilters = {}, now = new Date()) {
    return this.participation(actor, filters, now);
  }

  async preview(actor: Actor, input: CompliancePreviewInput, now = new Date()) {
    this.requirePreview(actor);
    const start = parsePreviewDate(input.activityDate);
    const end = parsePreviewDate(input.endDate);
    const duration = activityDuration({ activityDate: start, endDate: end, days: null });
    if (!start) throw badRequest('activityDate is required for compliance preview.');
    if (duration.issues.includes('end_before_start')) throw badRequest('End date cannot be before the start date.');
    const days = duration.days ?? 0;
    const year = duration.year || start.getUTCFullYear();
    const mk = activityMonthKey(start);
    const month = mk?.month || start.getUTCMonth() + 1;
    const participants = Array.isArray(input.participants) ? input.participants : [];
    if (!participants.length) {
      return {
        title: input.title || null,
        activityDate: start,
        endDate: end,
        durationDays: days,
        provenance: duration.provenance,
        year,
        month,
        monthLabel: monthLabel(year, month),
        participantCount: 0,
        blocking: false,
        warnings: [] as string[],
        summary: {
          earlyWarning: 0,
          thresholdReached: 0,
          exceeded: 0,
          monthlyLimitReached: 0,
          monthlyExceeded: 0,
          pendingAccountability: 0,
          overdueAccountability: 0,
          overlaps: 0,
          potentialOverlaps: 0,
        },
        participants: [],
        overlaps: [],
        potentialOverlaps: [],
      };
    }

    const [pRows, aRows] = await Promise.all([this.db.participationRows(year), this.db.accountabilityRows()]);
    const filteredRows = input.excludeActivityId
      ? pRows.filter((r) => r.activityId !== input.excludeActivityId)
      : pRows;
    const resolved = await this.resolvePreviewParticipants(participants);
    const personIds = [
      ...new Set(
        [
          ...filteredRows.map((r) => r.personId),
          ...aRows.map((r) => r.personId),
          ...resolved.map((r) => r.personId),
        ].filter((id): id is string => !!id),
      ),
    ];
    const userIds = [...new Set(aRows.map((a) => a.submittedById))];
    const [directory, users] = await Promise.all([this.db.directoryPeople(personIds), this.db.identityPeople(userIds)]);
    const peopleMap = new Map(directory.map((p) => [p.id, p]));
    const usersMap = new Map(users.map((p) => [p.id, p]));
    const monthlyTotals = this.buildMonthlyTotals(filteredRows, year);
    const annualTotals = new Map<string, number>();
    for (const r of filteredRows) {
      if (!r.personId || !isParticipationEligibleStatus(r.activityStatus)) continue;
      const d = activityDuration({ activityDate: r.activityDate, endDate: r.endDate, days: r.activityDays });
      if (d.days == null || d.year !== year) continue;
      annualTotals.set(r.personId, (annualTotals.get(r.personId) || 0) + d.days);
    }
    const accs = this.buildAccountabilities(aRows, usersMap, peopleMap, now);
    const accByPerson = new Map<string, typeof accs>();
    for (const a of accs) {
      if (!a.personId) continue;
      const list = accByPerson.get(a.personId) || [];
      list.push(a);
      accByPerson.set(a.personId, list);
    }

    const proposedEnd =
      end ||
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + Math.max(days, 1) - 1));
    const existingCandidates = this.overlapCandidates(filteredRows, peopleMap);
    const previewOverlaps: ReturnType<typeof findConfirmedOverlaps> = [];
    const previewPotential: ReturnType<typeof findPotentialNameOverlaps> = [];

    const impact = [];
    const allWarnings: string[] = [];
    for (const part of resolved) {
      const currentAnnual = part.personId ? annualTotals.get(part.personId) || 0 : 0;
      const currentMonth = part.personId ? monthlyTotals.get(part.personId)?.get(month) || 0 : 0;
      const projectedAnnual = currentAnnual + days;
      const projectedMonth = currentMonth + days;
      const annualStatus = thresholdStatus(projectedAnnual);
      const early = isEarlyWarning(projectedAnnual);
      const near = isNearLimit(projectedAnnual);
      const mStatus = monthlyStatus(projectedMonth);
      const personAccs = part.personId ? accByPerson.get(part.personId) || [] : [];
      const pending = personAccs.filter((a) => a.pending);
      const overdue = personAccs.filter((a) => a.overdue);
      const returned = personAccs.filter((a) => a.returned);
      const clarification = personAccs.filter((a) => a.clarificationRequested);

      let overlap = false;
      if (part.personId) {
        for (const c of existingCandidates.filter((x) => x.personId === part.personId)) {
          const a = { start, end: proposedEnd };
          const b = { start: c.start, end: c.end };
          if (!dateRangesOverlap(a, b)) continue;
          const period = overlapPeriod(a, b);
          if (!period) continue;
          overlap = true;
          previewOverlaps.push({
            personId: part.personId,
            personName: part.name,
            activityAId: 'preview',
            activityATitle: input.title || 'Proposed activity',
            activityBId: c.activityId,
            activityBTitle: c.title,
            overlapStart: period.start,
            overlapEnd: period.end,
            kind: 'OVERLAP_DETECTED',
          });
        }
      } else {
        const pot = findPotentialNameOverlaps([
          {
            activityId: 'preview',
            title: input.title || 'Proposed activity',
            referenceNumber: null,
            start,
            end: proposedEnd,
            personId: null,
            personName: part.name,
            normalizedName: normalizeName(part.name),
          },
          ...existingCandidates,
        ]);
        if (pot.length) {
          previewPotential.push(...pot);
        }
      }

      const flags: ComplianceFlag[] = [
        ...participationFlags(annualStatus, near, early),
        ...monthlyFlags(mStatus),
        ...accountabilityFlags(pending.length, overdue.length),
        ...(overlap ? (['OVERLAP_DETECTED'] as ComplianceFlag[]) : []),
        ...(previewPotential.some((p) => p.normalizedName === normalizeName(part.name))
          ? (['POTENTIAL_PARTICIPANT_OVERLAP'] as ComplianceFlag[])
          : []),
      ];
      const overall = displayOverall(flags);
      const messages = warningMessages({
        name: part.name,
        year,
        monthLabel: monthLabel(year, month),
        annualDays: projectedAnnual,
        monthlyStatus: mStatus,
        earlyWarning: early,
        thresholdStatus: annualStatus,
        overlap,
        pending: pending.length > 0,
        overdue: overdue.length > 0,
      });
      allWarnings.push(...messages);

      impact.push({
        name: part.name,
        phone: part.phone,
        personId: part.personId,
        personReference: part.personId ? peopleMap.get(part.personId)?.personReference || null : null,
        identityStatus: part.personId ? peopleMap.get(part.personId)?.identityStatus || null : 'unresolved',
        currentMonthDays: currentMonth,
        projectedMonthDays: projectedMonth,
        monthlyStatus: mStatus,
        monthlyThreshold: MONTHLY_FIELD_DAY_LIMIT,
        currentAnnualDays: currentAnnual,
        projectedAnnualDays: projectedAnnual,
        remainingAnnual: remainingDays(projectedAnnual),
        annualStatus,
        annualWarning: annualWarningStatus(projectedAnnual),
        earlyWarning: early,
        nearLimit: near,
        accountability: {
          pending: pending.length,
          overdue: overdue.length,
          returned: returned.length,
          clarification: clarification.length,
          status:
            overdue.length > 0
              ? 'overdue'
              : pending.length > 0
                ? 'pending'
                : returned.length > 0
                  ? 'returned'
                  : clarification.length > 0
                    ? 'clarification'
                    : 'clear',
        },
        overlap,
        potentialOverlap: previewPotential.some((p) => p.normalizedName === normalizeName(part.name)),
        flags,
        overallLabel: overall.label,
        result: overall.label,
        warnings: messages,
      });
    }

    const uniqueOverlaps = [...new Map(previewOverlaps.map((o) => [`${o.personId}:${o.activityBId}`, o])).values()];
    const uniquePotential = [
      ...new Map(previewPotential.map((o) => [`${o.normalizedName}:${o.activityBId}`, o])).values(),
    ];

    return {
      title: input.title || null,
      activityDate: start,
      endDate: end,
      durationDays: days,
      provenance: duration.provenance,
      year,
      month,
      monthLabel: monthLabel(year, month),
      participantCount: impact.length,
      blocking: false,
      warnings: [...new Set(allWarnings)],
      summary: {
        earlyWarning: impact.filter((p) => p.earlyWarning).length,
        thresholdReached: impact.filter((p) => p.annualStatus === 'threshold_reached').length,
        exceeded: impact.filter((p) => p.annualStatus === 'exceeded').length,
        monthlyLimitReached: impact.filter((p) => p.monthlyStatus === 'limit_reached').length,
        monthlyExceeded: impact.filter((p) => p.monthlyStatus === 'exceeded').length,
        pendingAccountability: impact.filter((p) => p.accountability.pending > 0).length,
        overdueAccountability: impact.filter((p) => p.accountability.overdue > 0).length,
        overlaps: uniqueOverlaps.length,
        potentialOverlaps: uniquePotential.length,
      },
      participants: impact,
      overlaps: uniqueOverlaps,
      potentialOverlaps: uniquePotential,
    };
  }

  private async resolvePreviewParticipants(participants: PreviewParticipantInput[]) {
    const out: { name: string; phone: string | null; personId: string | null }[] = [];
    for (const p of participants) {
      const name = String(p.name || '').trim();
      if (!name) continue;
      const phone = p.phone != null ? String(p.phone).trim() : null;
      let personId = p.personId ? String(p.personId) : null;
      if (!personId) {
        const normalized = normalizePhone(phone);
        if (normalized) {
          const matches = await this.db.findPeopleByPhoneNormalized(normalized);
          if (matches.length === 1) personId = matches[0].id;
        }
      }
      out.push({ name, phone, personId });
    }
    return out;
  }

  private groupUnlinked(
    unlinked: ReturnType<ComplianceService['buildAccountabilities']>,
    year: number,
    people: Map<string, DirectoryPerson>,
  ) {
    const byKey = new Map<string, typeof unlinked>();
    for (const a of unlinked) {
      const key = a.personId || `user:${a.submittedById}`;
      const list = byKey.get(key) || [];
      list.push(a);
      byKey.set(key, list);
    }
    return [...byKey.entries()].map(([key, accs]) => {
      const person = accs[0]?.personId ? people.get(accs[0].personId) : undefined;
      return this.personRow(year, null, accs, {
        identityKey: key,
        personId: accs[0]?.personId || null,
        personReference: person?.personReference || null,
        name: person?.fullName || accs[0]?.submittedByName,
        departmentName: person?.departmentName || accs[0]?.departmentName,
      });
    });
  }

  private applyFilters(
    rows: ReturnType<ComplianceService['personRow']>[],
    filters: ComplianceListFilters,
  ) {
    let out = rows;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          String(r.phone || '').includes(q) ||
          String(r.departmentName || '').toLowerCase().includes(q) ||
          String(r.personReference || '').toLowerCase().includes(q),
      );
    }
    if (filters.department) {
      const q = filters.department.toLowerCase();
      out = out.filter((r) => String(r.departmentName || '').toLowerCase().includes(q));
    }
    if (filters.participationStatus) {
      out = out.filter((r) => r.participationStatus === filters.participationStatus);
    }
    if (filters.exceeded) {
      out = out.filter((r) => r.participationStatus === 'exceeded' || r.participationStatus === 'threshold_reached');
    }
    if (filters.earlyWarning) out = out.filter((r) => r.earlyWarning);
    if (filters.monthlyExceeded) out = out.filter((r) => r.monthly?.status === 'exceeded');
    if (filters.monthlyLimit) out = out.filter((r) => r.monthly && r.monthly.status !== 'within_limit');
    if (filters.overlap) out = out.filter((r) => r.overlapCount > 0 || r.potentialOverlapCount > 0);
    if (filters.overdue) out = out.filter((r) => r.overdueCount > 0);
    if (filters.accountabilityStatus === 'pending') out = out.filter((r) => r.pendingCount > 0);
    if (filters.accountabilityStatus === 'overdue') out = out.filter((r) => r.overdueCount > 0);
    if (filters.accountabilityStatus === 'returned') {
      out = out.filter((r) => r.accountabilities.some((a) => a.status === 'returned'));
    }
    if (filters.accountabilityStatus === 'clarification') {
      out = out.filter((r) => r.accountabilities.some((a) => a.status === 'clarification_requested'));
    }
    out.sort((a, b) => b.totalDays - a.totalDays || b.overdueCount - a.overdueCount);
    return out;
  }
}

export { yearBounds };
