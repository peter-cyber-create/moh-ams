import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import {
  activityTitle,
  allowedNextStatuses,
  canEditActivity,
  canTransition,
  statusLabel,
} from '../lib/ams';
import api, { errorMessage } from '../lib/api';

const FUNDERS = ['GOU', 'GF-HIV', 'GF-COVID', 'GF-MALARIA', 'GF-TB', 'GF-RSSH', 'GF-COORDINATION', 'UCREPP', 'GAVI', 'ISHSP', 'CDC', 'WHO'];

export default function EditActivityPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/api/v1/activities/${id}`)
      .then((res) => {
        const a = res.data;
        setActivity(a);
        setForm({
          title: a.title || a.activityName || '',
          invoiceDate: a.invoiceDate ? String(a.invoiceDate).slice(0, 10) : '',
          endDate: a.endDate ? String(a.endDate).slice(0, 10) : '',
          amount: a.amount != null ? String(a.amount) : '',
          funder: a.funder || '',
          voucherNumber: a.voucherNumber || a.vocherno || '',
          status: a.status || 'planned',
        });
      })
      .catch((err) => setError(errorMessage(err, 'Could not load this activity.')));
  }, [id]);

  if (error && !activity) {
    return (
      <div>
        <p className="text-sm text-rose-700">{error}</p>
        <Link to="/activities" className="ams-btn-secondary mt-4 inline-flex">
          Return to my activities
        </Link>
      </div>
    );
  }
  if (!activity || !form) return <p className="text-sm text-ink-500">Loading…</p>;

  if (!canEditActivity(activity)) {
    return (
      <div>
        <PageHeader title={activityTitle(activity)} subtitle="This activity cannot be edited in its current status." />
        <p className="text-sm text-ink-700">
          The Finance API only accepts detail edits while status is planned or ongoing. Current status:{' '}
          {statusLabel(activity.status)}.
        </p>
        <Link to={`/activities/${id}`} className="ams-btn-primary mt-4 inline-flex">
          View activity
        </Link>
      </div>
    );
  }

  const statusOptions = [form.status, ...allowedNextStatuses(activity.status).filter((s) => s !== form.status)];

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    if (!form.title.trim()) {
      setError('Activity name is required.');
      return;
    }
    const amount = Number(String(form.amount).replace(/,/g, ''));
    if (!amount || amount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (form.status !== activity.status && !canTransition(activity.status, form.status)) {
      setError(`Invalid status transition: ${activity.status} → ${form.status}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/activities/${id}`, {
        title: form.title.trim(),
        invoiceDate: form.invoiceDate || undefined,
        endDate: form.endDate || undefined,
        amount,
        funder: form.funder || undefined,
        voucherNumber: form.voucherNumber.trim() || undefined,
        status: form.status,
      });
      navigate(`/activities/${id}`, { state: { notice: 'Activity updated.' } });
    } catch (err) {
      setError(errorMessage(err, 'Could not update this activity.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activities"
        title={`Edit ${activityTitle(activity)}`}
        subtitle="Planned, ongoing and draft activities can be edited. Participants are stored as ActivityParticipant rows."
        actions={<StatusPill status={activity.status} />}
      />
      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ams-card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="ams-label">Activity name</label>
          <input className="ams-input" value={form.title} onChange={(e) => update('title', e.target.value)} />
        </div>
        <div>
          <label className="ams-label">Activity date</label>
          <input
            type="date"
            className="ams-input"
            value={form.invoiceDate}
            onChange={(e) => update('invoiceDate', e.target.value)}
          />
        </div>
        <div>
          <label className="ams-label">End date</label>
          <input
            type="date"
            className="ams-input"
            value={form.endDate || ''}
            onChange={(e) => update('endDate', e.target.value)}
          />
        </div>
        <div>
          <label className="ams-label">Amount</label>
          <input className="ams-input" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
        </div>
        <div>
          <label className="ams-label">Funding source</label>
          <select className="ams-input" value={form.funder} onChange={(e) => update('funder', e.target.value)}>
            <option value="">Select</option>
            {FUNDERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ams-label">Voucher number</label>
          <input
            className="ams-input"
            value={form.voucherNumber}
            onChange={(e) => update('voucherNumber', e.target.value)}
          />
        </div>
        <div>
          <label className="ams-label">Status</label>
          <select className="ams-input" value={form.status} onChange={(e) => update('status', e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Link to={`/activities/${id}`} className="ams-btn-secondary">
            Cancel
          </Link>
          <button type="button" className="ams-btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
