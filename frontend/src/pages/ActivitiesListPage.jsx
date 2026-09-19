import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { activityTitle, formatDate, formatMoney, unwrapList } from '../lib/ams';
import api, { errorMessage } from '../lib/api';

export default function ActivitiesListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/api/v1/activities', {
        params: { page: 1, limit: 100, search: q || undefined, status: status || undefined },
      })
      .then((res) => {
        if (!cancelled) setRows(unwrapList(res.data));
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load activities.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, status]);

  const filtered = useMemo(() => rows, [rows]);

  return (
    <div>
      <PageHeader
        title="Activities"
        subtitle="Manage and track your activities."
        actions={
          <Link to="/activities/register" className="ams-btn-primary">
            + New Activity
          </Link>
        }
      />

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setQ(String(data.get('q') || '').trim());
        }}
      >
        <input name="q" className="ams-input min-w-[12rem] flex-1" placeholder="Search" defaultValue={q} />
        <select className="ams-input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="planned">Planned</option>
          <option value="ongoing">Ongoing</option>
          <option value="report_submitted">Report submitted</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="submit" className="ams-btn-secondary">
          Search
        </button>
      </form>

      {error ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-ink-500">Loading activities…</p> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title="No activities yet"
          body="Create an activity to get started."
          action={
            <Link to="/activities/register" className="ams-btn-primary">
              + New activity
            </Link>
          }
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-lg bg-white shadow-ams">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-ink-500">
                <th className="px-4 py-3 font-semibold">Activity</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Participants</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-ink-100 hover:bg-paper">
                  <td className="px-4 py-3 font-medium text-ink-900">{activityTitle(a)}</td>
                  <td className="px-4 py-3 text-ink-700">{formatDate(a.invoiceDate || a.activityDate)}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {Array.isArray(a.participants) ? a.participants.length : a.participantCount ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{formatMoney(a.amount ?? a.amt)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="font-semibold text-teal-800"
                      onClick={() => navigate(`/activities/${a.id}`)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
