import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import ProgressSteps from '../components/ProgressSteps';
import { CompliancePreviewPanel } from '../components/CompliancePreviewPanel';
import { ActivityFormFields } from '../components/ActivityFormFields';
import { ParticipantsPanel } from '../components/ParticipantsPanel';
import { formatDate, sanitizeParticipants } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { fetchCompliancePreview } from '../lib/compliancePreview';
import { TEMPLATE_DOWNLOADS, downloadTemplate } from '../lib/templates';
import {
  REGISTER_STEPS,
  activityPayloadFromForm,
  newMultiActivitySlot,
  summarizePreview,
  validateActivityForm,
} from '../lib/registerActivity';

export default function RegisterMultipleActivitiesPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [slots, setSlots] = useState(() => [{ ...newMultiActivitySlot(0), open: true }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [detailKey, setDetailKey] = useState(null);

  function patchSlot(key, patch) {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setConfirmed(false);
  }

  function addActivity() {
    setSlots((prev) => {
      const next = newMultiActivitySlot(prev.length);
      return [...prev.map((s) => ({ ...s, open: false })), { ...next, open: true }];
    });
  }

  function removeActivity(key) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  async function onDownloadTemplate() {
    setError('');
    try {
      await downloadTemplate(TEMPLATE_DOWNLOADS.participants, 'AMS_Participant_List_Template.xlsx');
    } catch (err) {
      setError(err.message || 'Could not download the template.');
    }
  }

  async function importForSlot(key, file) {
    setError('');
    const data = new FormData();
    data.append('file', file);
    try {
      const res = await api.post('/api/v1/activities/participants/import', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imported = Array.isArray(res.data?.rows) ? res.data.rows : [];
      patchSlot(key, {
        importSummary: res.data,
        rows: sanitizeParticipants(imported).map((r, idx) => ({ ...r, key: `${key}-${idx}` })),
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not import participants. Check the file and try again.'));
    }
  }

  function copyParticipants(fromKey, toKey) {
    const from = slots.find((s) => s.key === fromKey);
    if (!from) return;
    patchSlot(toKey, {
      rows: from.rows.map((r, idx) => ({ ...r, key: `${toKey}-c-${idx}` })),
      importSummary: null,
    });
  }

  function next() {
    if (step === 1) {
      for (let i = 0; i < slots.length; i++) {
        const msg = validateActivityForm(slots[i].form);
        if (msg) {
          setError(`Activity ${i + 1}: ${msg}`);
          patchSlot(slots[i].key, { open: true });
          return;
        }
      }
    }
    setError('');
    setStep((s) => Math.min(3, s + 1));
  }

  async function checkAll() {
    setChecking(true);
    setError('');
    try {
      const nextSlots = [];
      for (const slot of slots) {
        const participants = sanitizeParticipants(slot.rows);
        const preview = await fetchCompliancePreview({
          title: slot.form.activityName,
          activityDate: slot.form.invoiceDate,
          endDate: slot.form.endDate,
          participants,
        });
        nextSlots.push({
          ...slot,
          check: { preview, summary: summarizePreview(preview) },
        });
      }
      setSlots(nextSlots);
      setConfirmed(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not run the compliance check.'));
    } finally {
      setChecking(false);
    }
  }

  async function submitSelected() {
    if (!confirmed) {
      setError('Confirm that you have reviewed the checks.');
      return;
    }
    const selected = slots.filter((s) => s.selected);
    if (!selected.length) {
      setError('Select at least one activity to submit.');
      return;
    }
    setBusy(true);
    setError('');
    const created = [];
    try {
      for (const slot of selected) {
        const msg = validateActivityForm(slot.form);
        if (msg) throw new Error(msg);
        const participants = sanitizeParticipants(slot.rows);
        const body = activityPayloadFromForm(slot.form, 'planned', participants);
        const res = await api.post('/api/v1/activities', body);
        created.push(res.data.id);
      }
      navigate('/activities', {
        state: { notice: `Submitted ${created.length} activit${created.length === 1 ? 'y' : 'ies'}.` },
      });
    } catch (err) {
      setError(
        created.length
          ? `${errorMessage(err, 'Submit failed')} (${created.length} already saved).`
          : errorMessage(err, 'Could not submit activities.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Activity"
        subtitle="Enter one or more activities, add participants for each, then check and submit."
      />
      <ProgressSteps steps={REGISTER_STEPS} current={step} />
      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          {slots.map((slot, index) => (
            <section key={slot.key} className="rounded-lg bg-white shadow-ams">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
                <button
                  type="button"
                  className="text-left font-semibold text-ink-900"
                  onClick={() => patchSlot(slot.key, { open: !slot.open })}
                  aria-expanded={slot.open}
                >
                  Activity {index + 1}
                  {!slot.open ? (
                    <span className="mt-0.5 block text-sm font-normal text-ink-500">
                      {slot.form.activityName || 'Untitled'} ·{' '}
                      {slot.form.invoiceDate ? formatDate(slot.form.invoiceDate) : 'no date'}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="text-sm text-rose-700"
                  onClick={() => removeActivity(slot.key)}
                  disabled={slots.length <= 1}
                >
                  Remove
                </button>
              </div>
              {slot.open ? (
                <div className="p-4">
                  <ActivityFormFields form={slot.form} onChange={(form) => patchSlot(slot.key, { form })} />
                </div>
              ) : null}
            </section>
          ))}
          <button type="button" className="ams-btn-secondary" onClick={addActivity}>
            + Add Activity
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {slots.map((slot, index) => (
            <section key={slot.key} className="rounded-lg bg-white p-4 shadow-ams">
              <h2 className="mb-3 font-semibold text-ink-900">
                Activity {index + 1}: {slot.form.activityName || 'Untitled'}
              </h2>
              <ParticipantsPanel
                rows={slot.rows}
                importSummary={slot.importSummary}
                onDownloadTemplate={onDownloadTemplate}
                onUpload={(file) => importForSlot(slot.key, file)}
                onAddManual={() => {
                  const name = window.prompt(`Participant name for Activity ${index + 1}`);
                  if (!name?.trim()) return;
                  patchSlot(slot.key, {
                    rows: [
                      ...slot.rows,
                      {
                        key: `${slot.key}-m-${Date.now()}`,
                        name: name.trim(),
                        title: '',
                        phone: '',
                        amount: 0,
                        days: 0,
                      },
                    ],
                  });
                }}
                onRemoveRow={(rowKey) =>
                  patchSlot(slot.key, { rows: slot.rows.filter((r) => r.key !== rowKey) })
                }
                onCopyNote={
                  index > 0 ? (
                    <button
                      type="button"
                      className="font-semibold text-teal-800 underline"
                      onClick={() => copyParticipants(slots[0].key, slot.key)}
                    >
                      Copy participants from Activity 1
                    </button>
                  ) : null
                }
              />
            </section>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <button type="button" className="ams-btn-secondary" onClick={checkAll} disabled={checking}>
            {checking ? 'Checking…' : 'Check all activities'}
          </button>
          <ul className="divide-y divide-ink-100 rounded-lg bg-white shadow-ams">
            {slots.map((slot, index) => {
              const summary = slot.check?.summary || { level: 'unknown', label: 'Not checked yet' };
              const mark = summary.level === 'ok' ? '✓' : summary.level === 'alert' ? '●' : '⚠';
              const tone =
                summary.level === 'ok'
                  ? 'text-teal-800'
                  : summary.level === 'alert'
                    ? 'text-rose-700'
                    : 'text-amber-800';
              return (
                <li key={slot.key} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label className="flex min-w-0 flex-1 items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={slot.selected}
                        onChange={(e) => patchSlot(slot.key, { selected: e.target.checked })}
                      />
                      <span className="min-w-0">
                        <span className="font-semibold text-ink-900">
                          Activity {index + 1}: {slot.form.activityName || 'Untitled'}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-500">
                          {slot.form.invoiceDate || '—'}
                          {slot.form.endDate ? ` → ${slot.form.endDate}` : ''} · {slot.rows.length} participants
                        </span>
                        <span className={`mt-1 block text-sm font-semibold ${tone}`}>
                          {mark} {summary.label}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="text-sm font-semibold text-teal-800"
                      onClick={() => setDetailKey(detailKey === slot.key ? null : slot.key)}
                    >
                      {detailKey === slot.key ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  {detailKey === slot.key && slot.check?.preview ? (
                    <div className="mt-3 border-t border-ink-100 pt-3">
                      <CompliancePreviewPanel
                        preview={slot.check.preview}
                        loading={false}
                        error=""
                        startDate={slot.form.invoiceDate}
                        endDate={slot.form.endDate}
                        onChangeDates={({ start, end }) => {
                          patchSlot(slot.key, {
                            form: { ...slot.form, invoiceDate: start || '', endDate: end || '' },
                            check: null,
                          });
                        }}
                      />
                      <p className="mt-2 text-xs text-ink-500">After changing dates, run Check all again.</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <label className="flex items-start gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I have reviewed the checks. Warnings do not automatically reject an activity.</span>
          </label>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        {step > 1 ? (
          <button type="button" className="ams-btn-secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        ) : (
          <Link to="/activities" className="ams-btn-secondary">
            Cancel
          </Link>
        )}
        {step < 3 ? (
          <button type="button" className="ams-btn-primary" onClick={next}>
            Continue
          </button>
        ) : (
          <button type="button" className="ams-btn-primary" onClick={submitSelected} disabled={busy || !confirmed}>
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
}
