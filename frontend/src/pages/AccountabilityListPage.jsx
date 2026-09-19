import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { formatDate, formatMoney, unwrapList } from '../lib/ams';
import { roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { ACCOUNTABILITY_API } from '../lib/activityApi';
import { useAuth } from '../lib/AuthContext';

const VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'review', label: 'Under Review' },
  { id: 'returned', label: 'Returned' },
  { id: 'clarification', label: 'Clarification' },
];

export default function AccountabilityListPage() {
  const { user } = useAuth();
  const { isReviewer } = roleProfile(user);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = params.get('view') || (isReviewer ? 'review' : 'all');
  const search = params.get('q') || '';
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(search);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(ACCOUNTABILITY_API, {
        params: { view, search: search || undefined, page, limit: 20, sort: 'dueDate', order: 'asc' },
      })
      .then((res) => {
        if (cancelled) return;
        setRows(unwrapList(res.data));
        setTotal(Number(res.data?.total || 0));
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load accountabilities.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, search, page]);

  const visibleViews = VIEWS.filter((v) => v.id !== 'review' || isReviewer);

  return (
    <div>
      <PageHeader
        title="Accountability"
        subtitle="Track and submit financial accountability."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {visibleViews.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              view === v.id ? 'bg-teal-800 text-white' : 'bg-white text-ink-700'
            }`}
            onClick={() => {
              setPage(1);
              setParams({ view: v.id, ...(search ? { q: search } : {}) });
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setParams({ view, ...(query.trim() ? { q: query.trim() } : {}) });
        }}
      >
        <input
          className="ams-card min-w-[16rem] flex-1 px-3 py-2 text-sm"
          placeholder="Search reference, activity or department"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="ams-btn-secondary">
          Search
        </button>
      </form>

      {error ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-ink-500">Loading…</p> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState title="Nothing here" body="There are no accountability cases in this queue right now." />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="ams-card w-full text-left hover:ring-1 hover:ring-teal-800"
                onClick={() => navigate(`/accountability/${a.id}`)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.referenceNumber}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {a.activity?.title || 'Activity'} · Due {formatDate(a.dueDate)} · Advanced{' '}
                      {formatMoney(a.amountAdvanced)}
                      {a.overdue ? ' · Overdue' : ''}
                    </p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {total > 20 ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="ams-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button
            type="button"
            className="ams-btn-secondary"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <p className="mt-6 text-sm">
        <Link to="/" className="font-medium text-teal-800 underline">
          Return to my work
        </Link>
      </p>
    </div>
  );
}
