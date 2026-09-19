import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { formatDate, roleProfile, unwrapList } from '../lib/ams';
import { COMPLIANCE_API, complianceQuery, emptyComplianceCopy } from '../lib/compliance';
import { PERSON_API } from '../lib/activityApi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'participation', label: 'Participation' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'accountabilities', label: 'Accountabilities' },
  { id: 'overlaps', label: 'Overlaps' },
];

function readFilters(params) {
  return {
    tab: params.get('tab') || 'overview',
    year: Number(params.get('year') || new Date().getFullYear()),
    month: params.get('month') ? Number(params.get('month')) : undefined,
    search: params.get('q') || '',
    department: params.get('department') || '',
    earlyWarning: params.get('earlyWarning') === '1',
    monthlyLimit: params.get('monthlyLimit') === '1',
    monthlyExceeded: params.get('monthlyExceeded') === '1',
    exceeded: params.get('exceeded') === '1',
    overdue: params.get('overdue') === '1',
    overlap: params.get('overlap') === '1',
  };
}

function toParams(f) {
  const next = { tab: f.tab, year: String(f.year) };
  if (f.month) next.month = String(f.month);
  if (f.search) next.q = f.search;
  if (f.department) next.department = f.department;
  if (f.earlyWarning) next.earlyWarning = '1';
  if (f.monthlyLimit) next.monthlyLimit = '1';
  if (f.monthlyExceeded) next.monthlyExceeded = '1';
  if (f.exceeded) next.exceeded = '1';
  if (f.overdue) next.overdue = '1';
  if (f.overlap) next.overlap = '1';
  return next;
}

export default function CompliancePage() {
  const { user } = useAuth();
  const { isAdmin, isCompliance, isReviewer, isOfficer } = roleProfile(user);
  const allowed = isAdmin || isCompliance || isReviewer || isOfficer;
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const { tab, year, month, search } = filters;
  const [query, setQuery] = useState(search);
  const [dept, setDept] = useState(filters.department);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQuery(search);
    setDept(filters.department);
  }, [search, filters.department]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const path =
      tab === 'participation'
        ? `${COMPLIANCE_API}/participation`
        : tab === 'monthly'
          ? `${COMPLIANCE_API}/monthly`
          : tab === 'overlaps'
            ? `${COMPLIANCE_API}/overlaps`
            : tab === 'accountabilities'
              ? `${COMPLIANCE_API}/accountabilities`
              : tab === 'quality'
                ? `${PERSON_API}/quality`
                : `${COMPLIANCE_API}/overview`;
    api
      .get(path, {
        params: complianceQuery({
          year,
          month,
          search,
          department: filters.department,
          earlyWarning: filters.earlyWarning,
          monthlyLimit: filters.monthlyLimit,
          monthlyExceeded: filters.monthlyExceeded,
          exceeded: filters.exceeded,
          overdue: filters.overdue,
          overlap: filters.overlap,
          page: 1,
        }),
      })
      .then((res) => {
        if (!cancelled) setPayload(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load compliance.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    allowed,
    tab,
    year,
    month,
    search,
    filters.department,
    filters.earlyWarning,
    filters.monthlyLimit,
    filters.monthlyExceeded,
    filters.exceeded,
    filters.overdue,
    filters.overlap,
  ]);

  if (!allowed) {
    return (
      <EmptyState
        title="You do not have access to compliance."
        body="Ask a reviewer or administrator if you need this view."
        action={<Link to="/">Home</Link>}
      />
    );
  }

  const rows = unwrapList(payload);
  const summary = payload?.summary;
  const setFilter = (patch) => setParams(toParams({ ...filters, ...patch }));

  return (
    <div>
      <PageHeader
        title="Compliance"
        subtitle="Review participation and accountability issues."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t.id ? 'bg-teal-800 text-white' : 'bg-white text-ink-700'
            }`}
            onClick={() => setFilter({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter({ search: query.trim(), department: dept.trim() });
        }}
      >
        <input
          className="ams-input w-28"
          type="number"
          title="Year"
          value={year}
          onChange={(e) => setFilter({ year: Number(e.target.value) || year })}
        />
        <select
          className="ams-input w-36"
          value={month || ''}
          onChange={(e) => setFilter({ month: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' })}
            </option>
          ))}
        </select>
        <input
          className="ams-input min-w-[10rem] flex-1"
          placeholder="Search person"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input
          className="ams-input w-40"
          placeholder="Department"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        />
        <button type="submit" className="ams-btn-secondary">
          Search
        </button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <FilterChip active={filters.earlyWarning} onClick={() => setFilter({ earlyWarning: !filters.earlyWarning })}>
          Early warning (120+)
        </FilterChip>
        <FilterChip active={filters.exceeded} onClick={() => setFilter({ exceeded: !filters.exceeded })}>
          Annual threshold / exceeded
        </FilterChip>
        <FilterChip active={filters.monthlyLimit} onClick={() => setFilter({ monthlyLimit: !filters.monthlyLimit })}>
          Monthly limit
        </FilterChip>
        <FilterChip
          active={filters.monthlyExceeded}
          onClick={() => setFilter({ monthlyExceeded: !filters.monthlyExceeded })}
        >
          Monthly exceeded
        </FilterChip>
        <FilterChip active={filters.overlap} onClick={() => setFilter({ overlap: !filters.overlap })}>
          Overlap
        </FilterChip>
        <FilterChip active={filters.overdue} onClick={() => setFilter({ overdue: !filters.overdue })}>
          Overdue accountability
        </FilterChip>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-ink-500">Loading compliance…</p> : null}

      {!loading && summary && tab === 'overview' ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Early warning (120+)"
            value={summary.earlyWarning}
            to={`/compliance?tab=participation&year=${year}&earlyWarning=1`}
          />
          <SummaryCard
            label="At / over 150"
            value={summary.participationFlagged}
            to={`/compliance?tab=participation&year=${year}&exceeded=1`}
          />
          <SummaryCard
            label="Monthly limit issues"
            value={(summary.monthlyLimitReached || 0) + (summary.monthlyExceeded || 0)}
            to={`/compliance?tab=monthly&year=${year}&monthlyLimit=1`}
          />
          <SummaryCard
            label="Overlapping activities"
            value={summary.overlaps}
            to={`/compliance?tab=overlaps&year=${year}`}
          />
          <SummaryCard
            label="Pending accountabilities"
            value={summary.pendingAccountabilities}
            to={`/compliance?tab=accountabilities&year=${year}`}
          />
          <SummaryCard
            label="Overdue accountabilities"
            value={summary.overdueAccountabilities}
            to={`/compliance?tab=accountabilities&year=${year}&overdue=1`}
          />
        </div>
      ) : null}

      {!loading && !error && tab === 'overlaps' ? <OverlapsPanel payload={payload} year={year} /> : null}

      {!loading && !error && tab !== 'quality' && tab !== 'overlaps' && rows.length === 0 ? (
        <EmptyState title="Nothing here" body={emptyComplianceCopy(tab)} />
      ) : null}

      {!loading && tab === 'quality' ? <QualityPanel payload={payload} /> : null}

      {!loading && tab === 'accountabilities' ? (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="ams-card">
              <p className="font-semibold">{a.submittedByName}</p>
              <p className="mt-1 text-sm text-ink-500">
                {a.overdue ? 'Overdue' : 'Pending'} · {a.referenceNumber} · {a.status} · due {formatDate(a.dueDate)}
                {a.overdue ? ` · ${a.daysOutstanding} days overdue` : ''}
              </p>
              <Link to={`/accountability/${a.id}`} className="mt-2 inline-block text-sm font-semibold text-teal-800">
                Open case
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && tab === 'monthly' && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.personId || r.name}>
              <Link
                to={`/persons/${encodeURIComponent(r.personId)}?year=${year}`}
                className="ams-card block hover:ring-1 hover:ring-teal-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {r.personReference || '—'} · {r.departmentName || '—'} · month{' '}
                      {r.monthly?.totalDays ?? 0}/{r.monthly?.threshold ?? 20} · annual {r.annualTotal ?? 0}
                    </p>
                  </div>
                  <StatusPill status={r.overallLabel?.toLowerCase().replace(/ /g, '_') || r.monthly?.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && (tab === 'participation' || tab === 'overview') && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.identityKey || r.personId}>
              <Link
                to={`/persons/${encodeURIComponent(r.personId || r.identityKey)}?year=${year}`}
                className="ams-card block hover:ring-1 hover:ring-teal-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {r.personReference || r.identityKey} · {r.departmentName || '—'} · {r.totalDays} / {r.threshold}{' '}
                      days
                      {r.monthly ? ` · month ${r.monthly.totalDays}/${r.monthly.threshold}` : ''} ·{' '}
                      {r.pendingCount || 0} pending · {r.overdueCount || 0} overdue
                      {r.overlapCount ? ` · ${r.overlapCount} overlap(s)` : ''}
                    </p>
                  </div>
                  <StatusPill status={r.overallLabel?.toLowerCase().replace(/ /g, '_') || r.overall} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-semibold ${
        active ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300' : 'bg-white text-ink-600'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, to }) {
  return (
    <Link to={to} className="ams-card block">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 font-display text-3xl">{value ?? 0}</p>
      <p className="mt-2 text-sm font-semibold text-teal-800">Open →</p>
    </Link>
  );
}

function OverlapsPanel({ payload, year }) {
  const items = payload?.data || payload?.items || unwrapList(payload);
  if (!items.length) {
    return <EmptyState title="Nothing here" body={emptyComplianceCopy('overlaps')} />;
  }
  return (
    <ul className="space-y-3">
      {items.map((o, i) => (
        <li key={o.id || `${o.personId}-${i}`} className="ams-card">
          <p className="font-semibold">{o.personName || o.name || 'Participant'}</p>
          <p className="mt-1 text-sm text-ink-500">
            {o.activityATitle || o.activityA?.title} ↔ {o.activityBTitle || o.activityB?.title}
            {o.overlapStart ? ` · overlap ${formatDate(o.overlapStart)} – ${formatDate(o.overlapEnd)}` : ''}
          </p>
          {o.personId ? (
            <Link
              to={`/persons/${encodeURIComponent(o.personId)}?year=${year}`}
              className="mt-2 inline-block text-sm font-semibold text-teal-800"
            >
              Open person
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const QUALITY_LABELS = {
  peopleWithoutPhone: 'People without phone',
  duplicatePhoneCandidates: 'Duplicate phone candidates',
  participantsWithoutPerson: 'Participants without Person',
  identityUsersWithoutPerson: 'IdentityUsers without Person',
  legacyDurationRecords: 'Legacy stored-days duration',
  activitiesMissingEndDate: 'Activities missing end date',
  crossYearActivities: 'Cross-year activities',
  nameOnlyParticipants: 'Name-only participants',
};

function QualityPanel({ payload }) {
  if (!payload?.counts) {
    return <EmptyState title="Nothing here" body={emptyComplianceCopy('quality')} />;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(QUALITY_LABELS).map(([key, label]) => (
          <div key={key} className="ams-card">
            <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-2 font-display text-3xl">{payload.counts[key] ?? 0}</p>
          </div>
        ))}
      </div>
      {Object.entries(QUALITY_LABELS).map(([key, label]) => {
        const samples = payload.samples?.[key] || [];
        if (!samples.length) return null;
        return (
          <section key={key} className="ams-card">
            <h2 className="font-semibold">{label}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {samples.map((s) => (
                <li key={`${key}-${s.id}`}>
                  {s.label}
                  {s.detail ? <span className="text-ink-500"> · {s.detail}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
