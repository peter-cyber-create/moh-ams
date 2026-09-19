import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { formatDate, roleProfile } from '../lib/ams';
import { PERSON_API } from '../lib/activityApi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function PersonPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isReviewer, isAdmin } = roleProfile(user);
  const [params] = useSearchParams();
  const year = Number(params.get('year') || new Date().getFullYear());
  const [person, setPerson] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const personReq = api.get(`${PERSON_API}/${id}`);
    const complianceReq =
      isReviewer || isAdmin
        ? api.get(`${PERSON_API}/${id}/compliance`, { params: { year } }).catch(() => ({ data: null }))
        : Promise.resolve({ data: null });
    Promise.all([personReq, complianceReq])
      .then(([personRes, complianceRes]) => {
        if (cancelled) return;
        setPerson(personRes.data);
        setCompliance(complianceRes.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not open this person.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, year, isReviewer, isAdmin]);

  if (loading) return <p className="text-sm text-ink-500">Loading person…</p>;
  if (error || !person) {
    return (
      <div>
        <p className="text-sm text-rose-700">{error || 'Not found'}</p>
        <Link to="/activities" className="ams-btn-secondary mt-4 inline-flex">
          Back
        </Link>
      </div>
    );
  }

  const row = compliance;

  return (
    <div>
      <PageHeader
        eyebrow={person.personReference}
        title={person.fullName}
        subtitle={`${person.phone || 'No phone'} · ${person.organisation || person.departmentName || 'No organisation'} · ${person.identityStatus}`}
        actions={row ? <StatusPill status={row.overallLabel?.toLowerCase().replace(/ /g, '_') || row.overall} /> : null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ams-card space-y-2">
          <h2 className="font-display text-xl">Identity</h2>
          <p className="text-sm">Email: {person.email || '—'}</p>
          <p className="text-sm">Title: {person.title || '—'}</p>
          <p className="text-sm">
            AMS account:{' '}
            {person.identityUser ? `${person.identityUser.name} (${person.identityUser.email})` : 'None'}
          </p>
          <p className="text-sm text-ink-500">Submitter user and business person stay separate fields.</p>
        </section>

        <section className="ams-card space-y-2">
          <h2 className="font-display text-xl">Participation {year}</h2>
          {row ? (
            <>
              <p className="text-sm">
                {row.totalDays} / {row.threshold} days · remaining {row.remaining} · {row.participationStatus}
              </p>
              <p className="text-sm text-ink-500">
                {row.activityCount} activities · {row.pendingCount} pending accountabilities · {row.overdueCount} overdue
              </p>
              <table className="mt-3 min-w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-500">
                    <th className="py-1 pr-3">Activity</th>
                    <th className="py-1 pr-3">Dates</th>
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
                      <td className="py-2 pr-3">
                        {formatDate(a.startDate)} – {formatDate(a.endDate)}
                      </td>
                      <td className="py-2 pr-3">{a.days}</td>
                      <td className="py-2">{a.provenance}{a.crossYear ? ' · CROSS_YEAR_REVIEW' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-ink-500">Participation totals are available to reviewers from Compliance.</p>
          )}
        </section>
      </div>

      {row ? (
        <section className="ams-card mt-4 space-y-2">
          <h2 className="font-display text-xl">Accountabilities</h2>
          {(row.accountabilities || []).length === 0 ? (
            <p className="text-sm text-ink-500">No accountability cases on this Person for the current filters.</p>
          ) : (
            (row.accountabilities || []).map((a) => (
              <div key={a.id} className="border-t border-ink-100 py-3">
                <p className="font-semibold">
                  {a.overdue ? 'Overdue' : a.pending ? 'Pending' : a.status} · {a.referenceNumber}
                </p>
                <p className="text-sm text-ink-500">
                  {a.status} · due {formatDate(a.dueDate)}
                </p>
                <Link to={`/accountability/${a.id}`} className="text-sm font-semibold text-teal-800">
                  Open case
                </Link>
              </div>
            ))
          )}
        </section>
      ) : null}

      <Link to={`/compliance?year=${year}`} className="ams-btn-secondary mt-4 inline-flex">
        Back
      </Link>
    </div>
  );
}
