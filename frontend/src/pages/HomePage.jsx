import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { formatMoney, roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { TEMPLATE_DOWNLOADS, downloadTemplate } from '../lib/templates';

function StatCard({ label, stat, tone, sub }) {
  if (!stat) return null;
  const value = stat.value ?? stat;
  const href = stat.href;
  const inner = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      <span className={`font-display text-2xl ${tone === 'alert' ? 'text-rose-700' : 'text-ink-900'}`}>{value}</span>
      {sub ? <span className="text-xs text-ink-500">{sub}</span> : null}
    </>
  );
  return href ? (
    <Link to={href} className="rounded-lg bg-white px-4 py-3 shadow-ams hover:ring-2 hover:ring-teal-800/20">
      {inner}
    </Link>
  ) : (
    <div className="rounded-lg bg-white px-4 py-3 shadow-ams">{inner}</div>
  );
}

function StatSection({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-ink-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ListBlock({ title, items, emptyTitle, emptyBody, viewAllHref, viewAllLabel = 'View all' }) {
  if (!(items || []).length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg uppercase tracking-wide text-ink-900">{title}</h2>
        {viewAllHref ? (
          <Link to={viewAllHref} className="text-sm font-semibold text-teal-800">
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-ink-100 rounded-lg bg-white shadow-ams">
        {items.map((item) => (
          <li key={`${item.kind || 'row'}-${item.id}`}>
            <Link to={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
              <span className="block font-medium text-ink-900">{item.label || item.title || item.referenceNumber}</span>
              <span className="text-sm font-semibold text-teal-800">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { isOfficer, isReviewer } = roleProfile(user);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return api
      .get('/api/v1/dashboard/overview', { params: { year } })
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not load the dashboard.')))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  async function onUploadParticipants() {
    setUploadError('');
    try {
      await downloadTemplate(TEMPLATE_DOWNLOADS.participants, 'AMS_Participant_List_Template.xlsx');
    } catch (err) {
      setUploadError(err.message || 'Could not download the participant template.');
    }
  }

  const stats = data?.stats;
  const trend = data?.trends?.activitiesThisMonth;

  return (
    <div>
      <PageHeader
        title="AMS Dashboard"
        subtitle={data?.greeting || 'Operational overview'}
        actions={
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <span className="font-semibold">{data?.year || year}</span>
            <select
              className="ams-input py-1.5"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Reporting year"
            >
              {[year, year - 1, year - 2].map((y) => (
                <option key={y} value={y}>
                  {y === new Date().getFullYear() ? `This Year (${y})` : y}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-500">Loading dashboard…</p>
      ) : data && stats ? (
        <>
          <section className="mt-2" aria-label="Needs attention">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-ink-900">Needs attention</h2>
            {(data.attention || []).length > 0 ? (
              <ul className="space-y-2">
                {data.attention.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.href}
                      className={`flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-ams ${
                        item.tone === 'alert' ? 'border-l-4 border-l-rose-600' : 'border-l-4 border-l-amber-500'
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink-900">{item.label}</span>
                      <span className="font-display text-xl text-ink-900">{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg bg-teal-50 px-4 py-4 text-sm text-ink-700">
                <p className="font-semibold text-teal-900">All clear</p>
                <ul className="mt-2 space-y-1 text-ink-600">
                  {(data.attentionClear || ['No outstanding issues require your attention.']).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <StatSection title="Activities">
            <StatCard label="Total activities" stat={stats.activities.total} />
            <StatCard
              label="This month"
              stat={stats.activities.thisMonth}
              sub={trend ? `${trend.current} vs ${trend.previous} prior month` : undefined}
            />
            <StatCard label="Ongoing" stat={stats.activities.ongoing} />
            <StatCard label="Upcoming" stat={stats.activities.upcoming} />
            <StatCard label="Awaiting report" stat={stats.activities.reportsPending} tone="warn" />
            <StatCard label="Reports submitted" stat={stats.activities.reportsSubmitted} />
            <StatCard label="Recently closed" stat={stats.activities.recentlyClosed} />
          </StatSection>

          <StatSection title="Accountability">
            <StatCard label="Total cases" stat={stats.accountability.total} />
            <StatCard label="Pending" stat={stats.accountability.pending} />
            <StatCard label="Under review" stat={stats.accountability.underReview} />
            <StatCard label="Due" stat={stats.accountability.due} />
            <StatCard label="Overdue" stat={stats.accountability.overdue} tone="alert" />
            <StatCard label="Returned" stat={stats.accountability.returned} />
            <StatCard label="Clarification" stat={stats.accountability.clarification} />
            <StatCard label="Approved" stat={stats.accountability.approved} />
            <StatCard label="Closed" stat={stats.accountability.closed} />
          </StatSection>

          <StatSection title="People & participation">
            <StatCard label="Total people" stat={stats.participation.totalPeople} />
            <StatCard label="Monitored" stat={stats.participation.peopleMonitored} />
            <StatCard label="Early warning (120+)" stat={stats.participation.earlyWarning} tone="warn" />
            <StatCard label="At threshold (150)" stat={stats.participation.thresholdReached} tone="warn" />
            <StatCard label="Exceeded (>150)" stat={stats.participation.exceeded} tone="alert" />
            <StatCard label="Monthly limit issues" stat={stats.participation.monthlyLimit} />
            <StatCard label="Overlaps" stat={stats.participation.overlaps} />
          </StatSection>

          <section className="mt-8 rounded-lg bg-white px-4 py-4 shadow-ams">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-ink-900">Financial overview</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Advanced" stat={{ value: formatMoney(stats.financial.amountAdvanced), href: stats.financial.href }} />
              <StatCard label="Accounted" stat={{ value: formatMoney(stats.financial.amountAccounted), href: stats.financial.href }} />
              <StatCard label="Outstanding" stat={{ value: formatMoney(stats.financial.outstanding), href: stats.financial.href }} />
              <StatCard label="Variance" stat={{ value: formatMoney(stats.financial.variance), href: stats.financial.href }} />
            </div>
            <p className="mt-2 text-xs text-ink-500">{stats.financial.currency} · from accountabilities in your scope</p>
          </section>

          {data.dataQuality && (data.dataQuality.missingPhone > 0 || data.dataQuality.budgetVariance > 0) ? (
            <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
              <h2 className="mb-2 font-display text-lg uppercase tracking-wide text-amber-900">Data quality</h2>
              <ul className="space-y-1 text-ink-700">
                {data.dataQuality.missingPhone > 0 ? (
                  <li>{data.dataQuality.missingPhone} participant rows missing phone numbers</li>
                ) : null}
                {data.dataQuality.unmatchedParticipants > 0 ? (
                  <li>{data.dataQuality.unmatchedParticipants} participants not linked to a person record</li>
                ) : null}
                {data.dataQuality.budgetVariance > 0 ? (
                  <li>
                    {data.dataQuality.budgetVariance} budget lines with supplied vs calculated total discrepancies ·{' '}
                    <Link to={data.dataQuality.href} className="font-semibold text-teal-800">
                      Review
                    </Link>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          <ListBlock title="Upcoming" items={data.upcoming} viewAllHref="/accountability?view=due" />
          <ListBlock title="Recent activities" items={data.recentActivities} viewAllHref="/activities" />
          <ListBlock title="Recent accountabilities" items={data.recentAccountabilities} viewAllHref="/accountability?view=all" />

          {!data.upcoming?.length && !data.recentActivities?.length && !data.recentAccountabilities?.length ? (
            <EmptyState title="No recent items" body="Operational lists will appear as activities and accountabilities are recorded." />
          ) : null}

          <section className="mt-8" aria-label="Quick actions">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-ink-900">Quick actions</h2>
            <div className="flex flex-wrap gap-2">
              {isOfficer ? (
                <>
                  <Link to="/activities/register" className="ams-btn-primary">
                    + New Activity
                  </Link>
                  <Link to="/activities" className="ams-btn-secondary">
                    + New Accountability
                  </Link>
                  <button type="button" className="ams-btn-secondary" onClick={onUploadParticipants}>
                    Upload Participants
                  </button>
                </>
              ) : null}
              {isReviewer ? (
                <Link to="/accountability?view=review" className="ams-btn-secondary">
                  Review accountabilities
                </Link>
              ) : null}
            </div>
            {uploadError ? (
              <p className="mt-2 text-sm text-rose-700" role="alert">
                {uploadError}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
