import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { formatDate } from '../lib/ams';
import { COMPLIANCE_API } from '../lib/compliance';
import api, { errorMessage } from '../lib/api';

export default function CompliancePersonPage() {
  const { identityKey } = useParams();
  const [params] = useSearchParams();
  const year = Number(params.get('year') || new Date().getFullYear());
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`${COMPLIANCE_API}/participants/${encodeURIComponent(identityKey)}`, { params: { year } })
      .then((res) => {
        if (!cancelled) setRow(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not open this participant.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [identityKey, year]);

  if (loading) return <p className="text-sm text-ink-500">Loading participant…</p>;
  if (error || !row) {
    return (
      <div>
        <p className="text-sm text-rose-700">{error || 'Not found'}</p>
        <Link to="/compliance" className="ams-btn-secondary mt-4 inline-flex">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${row.year} compliance`}
        title={row.name}
        subtitle={`${row.personReference || row.identityKey} · ${row.phone || 'No phone'} · ${row.departmentName || 'No department'} · ${row.identityStatus || row.identityQuality}`}
        actions={<StatusPill status={row.overallLabel?.toLowerCase().replace(/ /g, '_') || row.overall} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ams-card space-y-2">
          <h2 className="font-display text-xl">Participation</h2>
          <p className="text-sm">
            {row.totalDays} / {row.threshold} days · remaining {row.remaining} · over {row.daysOver}
          </p>
          <p className="text-sm text-ink-500">{row.activityCount} activities in {row.year}</p>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="text-ink-500">
                <th className="py-1 pr-3">Activity</th>
                <th className="py-1 pr-3">Start</th>
                <th className="py-1 pr-3">End</th>
                <th className="py-1 pr-3">Days</th>
                <th className="py-1">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {(row.activities || []).map((a) => (
                <tr key={a.activityId} className="border-t border-ink-100">
                  <td className="py-2 pr-3">
                    <Link to={`/activities/${a.activityId}`} className="font-medium text-teal-800 underline">
                      {a.referenceNumber || a.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{formatDate(a.startDate)}</td>
                  <td className="py-2 pr-3">{formatDate(a.endDate)}</td>
                  <td className="py-2 pr-3">{a.days}</td>
                  <td className="py-2">{a.provenance || a.status}{a.crossYear ? ' · CROSS_YEAR_REVIEW' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ams-card space-y-2">
          <h2 className="font-display text-xl">Accountability</h2>
          <p className="text-sm">
            {row.pendingCount} pending · {row.overdueCount} overdue
          </p>
          {(row.accountabilities || []).length === 0 ? (
            <p className="text-sm text-ink-500">No pending accountability for this responsible person.</p>
          ) : (
            (row.accountabilities || []).map((a) => (
              <div key={a.id} className="border-t border-ink-100 py-3">
                <p className="font-semibold">
                  {a.overdue ? 'Overdue' : 'Pending'} · {a.referenceNumber}
                </p>
                <p className="text-sm text-ink-500">
                  {a.status} · due {formatDate(a.dueDate)}
                  {a.overdue ? ` · ${a.daysOutstanding} days overdue` : ''}
                </p>
                <Link to={`/accountability/${a.id}`} className="text-sm font-semibold text-teal-800">
                  Open case
                </Link>
              </div>
            ))
          )}
        </section>
      </div>

      <p className="mt-6 text-sm text-ink-600">
        Overall: {row.overallLabel}. Participation and accountability flags are independent. Aggregation is by Person, not name.
      </p>
      {row.personId ? (
        <Link to={`/persons/${row.personId}?year=${year}`} className="ams-btn-secondary mt-4 mr-2 inline-flex">
          Open Person profile
        </Link>
      ) : null}
      <Link to={`/compliance?year=${year}`} className="ams-btn-secondary mt-4 inline-flex">
        Back to compliance
      </Link>
    </div>
  );
}
