import type { Actor } from '../../domain/activity/permissions.js';
import { canViewCompliance } from '../../domain/compliance/permissions.js';
import { NOTIFICATION_TYPES } from '../../domain/notification/types.js';
import { prisma } from '../../infrastructure/prisma.js';
import { AccountabilityService } from '../accountability/accountability.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';
import { NotificationService } from '../notification/notification.service.js';

function greetingHour(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function stat(value: number, href: string) {
  return { value: Number(value || 0), href };
}

export class DashboardService {
  constructor(
    private readonly activities: ActivityService,
    private readonly accountabilities: AccountabilityService,
    private readonly compliance: ComplianceService,
    private readonly notifications: NotificationService,
  ) {}

  async getOverview(actor: Actor, year?: number, now = new Date()) {
    const selectedYear = year || now.getUTCFullYear();

    const [
      activityStats,
      accAll,
      accPending,
      accUnderReview,
      accOverdue,
      accReturned,
      accClarification,
      accApproved,
      accClosed,
      accDue,
      accDueCount,
      actRecent,
      actUpcoming,
      complianceOverview,
      financial,
      totalPeople,
      dataQuality,
    ] = await Promise.all([
      this.safeActivityStats(actor, selectedYear, now),
      this.safeAccCount(actor, 'all'),
      this.safeAccCount(actor, 'pending'),
      this.safeAccCount(actor, 'under_review'),
      this.safeAccCount(actor, 'overdue'),
      this.safeAccCount(actor, 'returned'),
      this.safeAccCount(actor, 'clarification'),
      this.safeAccCount(actor, 'approved'),
      this.safeAccCount(actor, 'closed'),
      this.safeAccList(actor, { view: 'due', page: 1, limit: 10 }),
      this.safeAccCount(actor, 'due'),
      this.activities.list(actor, { page: 1, limit: 8, sort: 'createdAt', order: 'desc' }),
      this.activities.list(actor, { page: 1, limit: 20, status: 'planned', sort: 'activityDate', order: 'asc' }),
      canViewCompliance(actor)
        ? this.compliance.overview(actor, { year: selectedYear, page: 1, limit: 1 })
        : Promise.resolve(null),
      this.safeFinancialTotals(actor),
      this.safeTotalPeople(),
      this.safeDataQuality(),
    ]);

    await this.syncStateNotifications(actor, {
      overdueItems: await this.safeAccList(actor, { view: 'overdue', page: 1, limit: 20 }),
      overview: complianceOverview,
      year: selectedYear,
      now,
    });

    const compSummary = complianceOverview?.summary || {};
    const exceeded = Number(compSummary.exceeded || 0);
    const thresholdReached = Number(compSummary.thresholdReached || 0);
    const monthlyExceeded = Number(compSummary.monthlyExceeded || 0);
    const overlaps = Number(compSummary.overlaps || 0);
    const earlyWarning = Number(compSummary.earlyWarning || 0);
    const peopleMonitored = Number(complianceOverview?.total || 0);

    const attention = [
      accOverdue > 0
        ? {
            key: 'overdue',
            label: `${accOverdue} overdue accountabilit${accOverdue === 1 ? 'y' : 'ies'}`,
            count: accOverdue,
            href: '/accountability?view=overdue',
            tone: 'alert',
          }
        : null,
      accReturned > 0
        ? {
            key: 'returned',
            label: `${accReturned} returned accountabilit${accReturned === 1 ? 'y' : 'ies'}`,
            count: accReturned,
            href: '/accountability?view=returned',
            tone: 'warn',
          }
        : null,
      accClarification > 0
        ? {
            key: 'clarification',
            label: `${accClarification} clarification request${accClarification === 1 ? '' : 's'}`,
            count: accClarification,
            href: '/accountability?view=clarification',
            tone: 'warn',
          }
        : null,
      activityStats.reportsPending > 0
        ? {
            key: 'reports-pending',
            label: `${activityStats.reportsPending} activit${activityStats.reportsPending === 1 ? 'y' : 'ies'} awaiting report`,
            count: activityStats.reportsPending,
            href: '/activities?missingReport=1',
            tone: 'warn',
          }
        : null,
      thresholdReached > 0
        ? {
            key: 'threshold',
            label: `${thresholdReached} ${thresholdReached === 1 ? 'person' : 'people'} at 150-day threshold`,
            count: thresholdReached,
            href: `/compliance?tab=participation&year=${selectedYear}&thresholdReached=1`,
            tone: 'warn',
          }
        : null,
      exceeded > 0
        ? {
            key: 'exceeded',
            label: `${exceeded} ${exceeded === 1 ? 'person' : 'people'} above annual limit`,
            count: exceeded,
            href: `/compliance?tab=participation&year=${selectedYear}&exceeded=1`,
            tone: 'alert',
          }
        : null,
      monthlyExceeded > 0
        ? {
            key: 'monthly',
            label: `${monthlyExceeded} monthly limit issue${monthlyExceeded === 1 ? '' : 's'}`,
            count: monthlyExceeded,
            href: `/compliance?tab=monthly&year=${selectedYear}&monthlyExceeded=1`,
            tone: 'warn',
          }
        : null,
      overlaps > 0
        ? {
            key: 'overlaps',
            label: `${overlaps} activity overlap${overlaps === 1 ? '' : 's'} need review`,
            count: overlaps,
            href: `/compliance?tab=overlaps&year=${selectedYear}`,
            tone: 'warn',
          }
        : null,
    ].filter(Boolean);

    const attentionClear = [
      accOverdue === 0 ? 'No overdue accountabilities' : null,
      accReturned === 0 ? 'No returned accountabilities' : null,
      accClarification === 0 ? 'No open clarification requests' : null,
      activityStats.reportsPending === 0 ? 'No activities awaiting reports' : null,
      exceeded === 0 && thresholdReached === 0 ? 'No annual participation limit issues' : null,
      monthlyExceeded === 0 ? 'No monthly participation violations' : null,
      overlaps === 0 ? 'No overlapping activities flagged' : null,
    ].filter(Boolean);

    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const inSevenDays = new Date(startOfToday);
    inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);

    const upcomingDue = accDue.data.map((a) => ({
      id: a.id,
      kind: 'accountability' as const,
      referenceNumber: a.referenceNumber,
      dueDate: a.dueDate,
      status: a.status,
      href: `/accountability/${a.id}`,
      label: `${a.referenceNumber} · due ${String(a.dueDate || '').slice(0, 10)}`,
    }));

    const upcomingActivities = (actUpcoming.data || [])
      .filter((a: Record<string, unknown>) => {
        const d = a.activityDate || a.invoiceDate;
        if (!d) return false;
        const dt = new Date(String(d));
        return dt >= startOfToday && dt <= inSevenDays;
      })
      .slice(0, 5)
      .map((a: Record<string, unknown>) => ({
        id: a.id,
        kind: 'activity' as const,
        title: a.title || a.activityName,
        date: a.activityDate || a.invoiceDate,
        status: a.status,
        href: `/activities/${a.id}`,
        label: `${a.title || a.activityName} · ${String(a.activityDate || a.invoiceDate || '').slice(0, 10)}`,
      }));

    const upcoming = [...upcomingDue, ...upcomingActivities].slice(0, 8);

    for (const a of accDue.data) {
      if (!a.id || !a.dueDate) continue;
      const due = new Date(String(a.dueDate));
      const daysLeft = Math.ceil((due.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
      if (daysLeft < 0 || daysLeft > 3) continue;
      await this.notifications.notify({
        recipientUserId: actor.id,
        type: NOTIFICATION_TYPES.ACCOUNTABILITY_DUE_SOON,
        title: 'Accountability due soon',
        message: `${a.referenceNumber || 'Case'} is due ${String(a.dueDate).slice(0, 10)}.`,
        referenceType: 'accountability',
        referenceId: String(a.id),
        href: `/accountability/${a.id}`,
        dedupeKey: `due-soon:${a.id}:${String(a.dueDate).slice(0, 10)}`,
      });
    }

    const recentActivities = (actRecent.data || []).slice(0, 5).map((a: Record<string, unknown>) => ({
      id: a.id,
      title: a.title || a.activityName,
      status: a.status,
      date: a.invoiceDate || a.activityDate || a.createdAt,
      href: `/activities/${a.id}`,
    }));

    const recentAccList = await this.safeAccList(actor, { view: 'all', page: 1, limit: 5, sort: 'createdAt', order: 'desc' });
    const recentAccountabilities = recentAccList.data.slice(0, 5).map((a) => ({
      id: a.id,
      referenceNumber: a.referenceNumber,
      status: a.status,
      dueDate: a.dueDate,
      href: `/accountability/${a.id}`,
    }));

    const prevMonthDate = new Date(Date.UTC(selectedYear, now.getUTCMonth() - 1, 15));
    const prevMonthStats = await this.safeActivityStats(actor, prevMonthDate.getUTCFullYear(), prevMonthDate);
    const trends = {
      activitiesThisMonth: {
        current: activityStats.thisMonth,
        previous: prevMonthStats.thisMonth,
        label: 'Activities this month vs prior month',
      },
    };

    const stats = {
      activities: {
        total: stat(activityStats.total, '/activities'),
        thisMonth: stat(activityStats.thisMonth, '/activities'),
        ongoing: stat(activityStats.ongoing, '/activities?status=ongoing'),
        upcoming: stat(activityStats.upcoming, '/activities?status=planned'),
        reportsPending: stat(activityStats.reportsPending, '/activities?missingReport=1'),
        reportsSubmitted: stat(activityStats.reportsSubmitted, '/activities?status=report_submitted'),
        recentlyClosed: stat(activityStats.recentlyClosed, '/activities?status=closed'),
      },
      accountability: {
        total: stat(accAll, '/accountability?view=all'),
        pending: stat(accPending, '/accountability?view=pending'),
        underReview: stat(accUnderReview, '/accountability?view=review'),
        due: stat(accDueCount, '/accountability?view=due'),
        overdue: stat(accOverdue, '/accountability?view=overdue'),
        returned: stat(accReturned, '/accountability?view=returned'),
        clarification: stat(accClarification, '/accountability?view=clarification'),
        approved: stat(accApproved, '/accountability?view=approved'),
        closed: stat(accClosed, '/accountability?view=closed'),
      },
      participation: {
        totalPeople: stat(totalPeople, '/reports?category=people'),
        peopleMonitored: stat(peopleMonitored, `/compliance?tab=participation&year=${selectedYear}`),
        earlyWarning: stat(earlyWarning, `/compliance?tab=participation&year=${selectedYear}&earlyWarning=1`),
        thresholdReached: stat(thresholdReached, `/compliance?tab=participation&year=${selectedYear}&thresholdReached=1`),
        exceeded: stat(exceeded, `/compliance?tab=participation&year=${selectedYear}&exceeded=1`),
        monthlyLimit: stat(monthlyExceeded, `/compliance?tab=monthly&year=${selectedYear}&monthlyExceeded=1`),
        overlaps: stat(overlaps, `/compliance?tab=overlaps&year=${selectedYear}`),
      },
      financial: {
        amountAdvanced: financial.amountAdvanced,
        amountAccounted: financial.amountAccounted,
        outstanding: financial.outstanding,
        variance: financial.variance,
        currency: 'UGX',
        href: '/reports?category=financial',
      },
    };

    return {
      year: selectedYear,
      periodLabel: 'This Year',
      greeting: `${greetingHour(now)}${actor.name ? `, ${actor.name.split(' ')[0]}` : ''}`,
      caughtUp: attention.length === 0,
      attention,
      attentionClear,
      stats,
      trends,
      dataQuality,
      upcoming,
      recentActivities,
      recentAccountabilities,
    };
  }

  /** @deprecated use getOverview — kept for notification side-effects on legacy clients */
  async getHome(actor: Actor, now = new Date()) {
    const overview = await this.getOverview(actor, undefined, now);
    return {
      ...overview,
      actionRequired: overview.attention.map((a) => ({ ...a, priority: 1 })),
      participationWatch: [],
      summary: {
        dueAccountabilities: overview.stats.accountability.pending.value,
        overdueAccountabilities: overview.stats.accountability.overdue.value,
        reviewQueue: overview.stats.accountability.underReview.value,
        earlyWarning: overview.stats.participation.earlyWarning.value,
        participationFlagged: overview.stats.participation.thresholdReached.value + overview.stats.participation.exceeded.value,
        monthlyExceeded: overview.stats.participation.monthlyLimit.value,
        overlaps: overview.stats.participation.overlaps.value,
        unreadNotifications: 0,
      },
    };
  }

  private async safeActivityStats(actor: Actor, year: number, now: Date) {
    try {
      return await this.activities.countStats(actor, year, now);
    } catch {
      return {
        total: 0,
        thisMonth: 0,
        ongoing: 0,
        upcoming: 0,
        reportsPending: 0,
        reportsSubmitted: 0,
        recentlyClosed: 0,
      };
    }
  }

  private async safeTotalPeople() {
    try {
      return await prisma.person.count({ where: { status: 'active' } });
    } catch {
      return 0;
    }
  }

  private async safeDataQuality() {
    try {
      const [missingPhone, unmatchedParticipants, budgetLines] = await Promise.all([
        prisma.activityParticipant.count({ where: { OR: [{ phone: null }, { phone: '' }] } }),
        prisma.activityParticipant.count({ where: { personId: null } }),
        prisma.activityBudgetLine.findMany({
          where: { suppliedAmount: { not: null }, calculatedAmount: { not: null } },
          select: { suppliedAmount: true, calculatedAmount: true },
          take: 5000,
        }),
      ]);
      const budgetVariance = budgetLines.filter(
        (row) => Math.abs(Number(row.suppliedAmount) - Number(row.calculatedAmount)) > 0.01,
      ).length;
      return {
        missingPhone,
        unmatchedParticipants,
        budgetVariance,
        href: '/reports?category=financial',
      };
    } catch {
      return { missingPhone: 0, unmatchedParticipants: 0, budgetVariance: 0, href: '/reports?category=financial' };
    }
  }

  private async safeFinancialTotals(actor: Actor) {
    try {
      return await this.accountabilities.financialTotals(actor);
    } catch {
      return { amountAdvanced: 0, amountAccounted: 0, amountReturned: 0, outstanding: 0, variance: 0 };
    }
  }

  private async safeAccCount(actor: Actor, view: string) {
    try {
      const res = await this.accountabilities.list(actor, { view, page: 1, limit: 1 });
      return Number(res.total || 0);
    } catch {
      return 0;
    }
  }

  private async safeAccList(actor: Actor, filters: Record<string, unknown>) {
    try {
      const res = await this.accountabilities.list(actor, filters as never);
      return { total: Number(res.total || 0), data: res.data || [] };
    } catch {
      return { total: 0, data: [] as Array<Record<string, unknown> & { id: string }> };
    }
  }

  private async syncStateNotifications(
    actor: Actor,
    ctx: {
      overdueItems: { data: Array<Record<string, unknown> & { id?: string; referenceNumber?: string; dueDate?: string }> };
      overview: Awaited<ReturnType<ComplianceService['overview']>> | null;
      year: number;
      now: Date;
    },
  ) {
    for (const a of ctx.overdueItems.data) {
      if (!a.id) continue;
      await this.notifications.notify({
        recipientUserId: actor.id,
        type: NOTIFICATION_TYPES.ACCOUNTABILITY_OVERDUE,
        title: 'Accountability overdue',
        message: `${a.referenceNumber || 'Case'} is overdue${a.dueDate ? ` (due ${String(a.dueDate).slice(0, 10)})` : ''}.`,
        referenceType: 'accountability',
        referenceId: String(a.id),
        href: `/accountability/${a.id}`,
        dedupeKey: `overdue:${a.id}`,
      });
    }

    if (!ctx.overview?.data) return;
    for (const r of ctx.overview.data) {
      if (!r.personId) continue;
      const href = `/persons/${r.personId}`;
      if (r.participationStatus === 'exceeded') {
        await this.notifications.notify({
          recipientUserId: actor.id,
          type: NOTIFICATION_TYPES.PARTICIPATION_EXCEEDED,
          title: 'Annual field-day limit exceeded',
          message: `${r.name} has ${r.totalDays} field days in ${ctx.year} (limit ${r.threshold}).`,
          referenceType: 'person',
          referenceId: r.personId,
          href,
          dedupeKey: `exceeded:${r.personId}:${ctx.year}`,
        });
      } else if (r.participationStatus === 'threshold_reached') {
        await this.notifications.notify({
          recipientUserId: actor.id,
          type: NOTIFICATION_TYPES.PARTICIPATION_THRESHOLD_REACHED,
          title: 'Annual field-day threshold reached',
          message: `${r.name} has reached ${r.threshold} field days in ${ctx.year}.`,
          referenceType: 'person',
          referenceId: r.personId,
          href,
          dedupeKey: `threshold:${r.personId}:${ctx.year}`,
        });
      } else if (r.earlyWarning) {
        await this.notifications.notify({
          recipientUserId: actor.id,
          type: NOTIFICATION_TYPES.PARTICIPATION_EARLY_WARNING,
          title: 'Approaching annual field-day limit',
          message: `${r.name} has ${r.totalDays} field days in ${ctx.year} and is approaching the ${r.threshold}-day limit.`,
          referenceType: 'person',
          referenceId: r.personId,
          href,
          dedupeKey: `early:${r.personId}:${ctx.year}`,
        });
      }
      if (r.monthly?.status === 'exceeded') {
        await this.notifications.notify({
          recipientUserId: actor.id,
          type: NOTIFICATION_TYPES.MONTHLY_LIMIT_EXCEEDED,
          title: 'Monthly field-day limit exceeded',
          message: `${r.name} exceeded the ${r.monthly.threshold}-day monthly limit (${r.monthly.totalDays} days in ${r.monthly.label || 'this month'}).`,
          referenceType: 'person',
          referenceId: r.personId,
          href,
          dedupeKey: `monthly:${r.personId}:${ctx.year}:${r.monthly.month}`,
        });
      }
    }

    if (ctx.overview.summary?.overlaps) {
      await this.notifications.notify({
        recipientUserId: actor.id,
        type: NOTIFICATION_TYPES.ACTIVITY_OVERLAP_REVIEW,
        title: 'Activity overlaps need review',
        message: `${ctx.overview.summary.overlaps} overlapping activity pair(s) detected in ${ctx.year}.`,
        referenceType: 'compliance',
        referenceId: `overlaps:${ctx.year}`,
        href: `/compliance?tab=overlaps&year=${ctx.year}`,
        dedupeKey: `overlaps:${ctx.year}`,
      });
    }
  }
}
