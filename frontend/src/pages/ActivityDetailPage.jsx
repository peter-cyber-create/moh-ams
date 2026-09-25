import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import NextAction from '../components/NextAction';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import {
  activityRef,
  activityTitle,
  canEditActivity,
  formatDate,
  formatMoney,
  needsActivityReport,
  validateReportFile,
} from '../lib/ams';
import { roleProfile, unwrapList } from '../lib/ams';
import api, { errorMessage, openAuthenticatedFile } from '../lib/api';
import { ACCOUNTABILITY_API } from '../lib/activityApi';
import { useAuth } from '../lib/AuthContext';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'participants', label: 'Participants' },
  { id: 'documents', label: 'Documents' },
  { id: 'financials', label: 'Financials' },
  { id: 'timeline', label: 'Timeline' },
];

export default function ActivityDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOfficer } = roleProfile(user);
  const [activity, setActivity] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [cases, setCases] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [docError, setDocError] = useState('');
  const notice = location.state?.notice;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/v1/activities/${id}`),
      api.get(`/api/v1/activities/${id}/timeline`),
      api.get(ACCOUNTABILITY_API, { params: { activityId: id, page: 1, limit: 10 } }).catch(() => ({ data: { data: [] } })),
    ])
      .then(([a, t, c]) => {
        if (cancelled) return;
        setActivity(a.data);
        setTimeline(Array.isArray(t.data?.data) ? t.data.data : []);
        setCases(unwrapList(c.data));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Could not load this activity.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="text-sm text-ink-500">Loading activity…</p>;
  if (loadError) {
    return (
      <div>
        <p className="text-sm text-rose-700">{loadError}</p>
        <Link to="/activities" className="ams-btn-secondary mt-4 inline-flex">
          Return to my activities
        </Link>
      </div>
    );
  }
  if (!activity) return null;

  const participants = Array.isArray(activity.participants) ? activity.participants : [];
  const due = needsActivityReport(activity);
  const status = String(activity.status || '').toLowerCase();
  const canCreateCase = isOfficer && status !== 'draft' && status !== 'cancelled';
  const openCase = cases.find((c) => c.status !== 'rejected' && c.status !== 'closed');

  async function submitActivityReport() {
    const fileError = validateReportFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('activityReport', file);
      const res = await api.post(`/api/v1/activities/${id}/report`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setActivity(res.data);
      setFile(null);
      navigate(`/activities/${id}`, { replace: true, state: { notice: 'Activity report submitted. This is not an accountability case.' } });
    } catch (err) {
      setError(errorMessage(err, 'Could not submit the activity report.'));
    } finally {
      setBusy(false);
    }
  }

  async function createAccountability() {
    setBusy(true);
    setError('');
    try {
      const created = await api.post(ACCOUNTABILITY_API, { activityId: id });
      navigate(`/accountability/${created.data.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create an accountability case.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title={activityTitle(activity)}
        subtitle={`${activityRef(activity)} · ${activity.department?.name || activity.dept || 'No department'} · ${formatDate(activity.invoiceDate)}${activity.endDate ? ` – ${formatDate(activity.endDate)}` : ''}`}
        actions={<StatusPill status={activity.status} />}
      />

      {notice ? (
        <div className="mb-6 rounded-2xl bg-teal-100 p-4 text-sm text-teal-900">{notice}</div>
      ) : null}
      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t.id ? 'bg-teal-800 text-white' : 'bg-white text-ink-700'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="ams-card grid gap-4 sm:grid-cols-2">
          <Item label="Requested by" value={activity.requested_by || activity.description || '—'} />
          <Item label="Funding source" value={activity.funder || '—'} />
          <Item label="Amount" value={formatMoney(activity.amount ?? activity.amt)} />
          <Item label="Voucher" value={activityRef(activity)} />
        </div>
      ) : null}

      {tab === 'participants' ? (
        <div className="space-y-3">
          {participants.length === 0 ? (
            <p className="text-sm text-ink-500">No participants recorded.</p>
          ) : (
            participants.map((p, i) => (
              <article key={p.id || i} className="ams-card">
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-ink-500">
                  {p.title || '—'} · {p.days ?? 0} days · {formatMoney(p.amount)}
                </p>
                {p.personId ? (
                  <Link to={`/persons/${p.personId}`} className="mt-1 inline-block text-sm font-semibold text-teal-800">
                    Open Person
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-ink-500">No Person linked yet</p>
                )}
              </article>
            ))
          )}
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className="ams-card space-y-3">
          {activity.reportPath ? (
            <button
              type="button"
              className="font-medium text-teal-800 underline"
              onClick={() => {
                setDocError('');
                openAuthenticatedFile(activity.reportPath).catch((err) =>
                  setDocError(errorMessage(err, 'Could not open the activity report.')),
                );
              }}
            >
              Open submitted activity report
            </button>
          ) : (
            <p className="text-sm text-ink-500">No activity report file yet. This file belongs to the activity, not to an accountability case.</p>
          )}
          {docError ? (
            <p className="text-sm text-rose-700" role="alert">
              {docError}
            </p>
          ) : null}
          {due ? (
            <div className="space-y-2">
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button type="button" className="ams-btn-primary" onClick={submitActivityReport} disabled={busy}>
                Submit activity report
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'financials' ? (
        <details className="ams-card" open>
          <summary className="cursor-pointer font-semibold">Financial breakdown</summary>
          <p className="mt-3 text-sm text-ink-700">Activity amount: {formatMoney(activity.amount ?? activity.amt)}</p>
          <p className="mt-1 text-sm text-ink-500">
            Participant total:{' '}
            {formatMoney(participants.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))}
          </p>
        </details>
      ) : null}

      {tab === 'timeline' ? (
        <div className="ams-card space-y-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-ink-500">No history yet.</p>
          ) : (
            timeline.map((event) => (
              <div key={event.id} className="border-b border-ink-100 pb-3 last:border-0">
                <p className="text-sm font-semibold text-ink-900">{event.summary || event.action}</p>
                <p className="text-xs text-ink-500">
                  {formatDate(event.createdAt)} · {event.actor?.name || 'System'}
                </p>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div className="mt-8">
        {due ? (
          <NextAction
            title="An activity report is still required"
            body="Upload the activity report on this activity. Creating an accountability case is a separate step and is not implied by report_submitted."
          >
            <button type="button" className="ams-btn-secondary" onClick={() => setTab('documents')}>
              Go to documents
            </button>
            {canCreateCase && openCase ? (
              <Link to={`/accountability/${openCase.id}`} className="ams-btn-primary">
                Open accountability {openCase.referenceNumber}
              </Link>
            ) : null}
            {canCreateCase && !openCase ? (
              <button type="button" className="ams-btn-primary" onClick={createAccountability} disabled={busy}>
                Create accountability
              </button>
            ) : null}
            {canEditActivity(activity) ? (
              <Link to={`/activities/${activity.id}/edit`} className="ams-btn-secondary">
                Edit activity
              </Link>
            ) : null}
            <Link to="/" className="ams-btn-secondary">
              Return to my work
            </Link>
          </NextAction>
        ) : (
          <NextAction
            title="Activity report is on file"
            body="If this activity needs financial accountability, open or create a separate accountability case."
          >
            {openCase ? (
              <Link to={`/accountability/${openCase.id}`} className="ams-btn-primary">
                Open accountability {openCase.referenceNumber}
              </Link>
            ) : canCreateCase ? (
              <button type="button" className="ams-btn-primary" onClick={createAccountability} disabled={busy}>
                Create accountability
              </button>
            ) : (
              <Link to="/" className="ams-btn-primary">
                Return to my work
              </Link>
            )}
            {canEditActivity(activity) ? (
              <Link to={`/activities/${activity.id}/edit`} className="ams-btn-secondary">
                Edit activity
              </Link>
            ) : null}
            <Link to="/accountability" className="ams-btn-secondary">
              Accountability queue
            </Link>
          </NextAction>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-sm text-ink-900">{value}</p>
    </div>
  );
}
