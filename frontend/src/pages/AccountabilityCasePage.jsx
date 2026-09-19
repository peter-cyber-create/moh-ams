import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NextAction from '../components/NextAction';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { formatDate, formatMoney, validateReportFile } from '../lib/ams';
import { roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { ACCOUNTABILITY_API } from '../lib/activityApi';
import { useAuth } from '../lib/AuthContext';

export default function AccountabilityCasePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isReviewer, isOfficer } = roleProfile(user);
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [activity, setActivity] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [lines, setLines] = useState([{ description: '', amount: '' }]);
  const [amountReturned, setAmountReturned] = useState('0');
  const [file, setFile] = useState(null);
  const [reason, setReason] = useState('');
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [c, t] = await Promise.all([
      api.get(`${ACCOUNTABILITY_API}/${id}`),
      api.get(`${ACCOUNTABILITY_API}/${id}/timeline`),
    ]);
    setRow(c.data);
    setTimeline(Array.isArray(t.data?.data) ? t.data.data : []);
    setLines(
      c.data.lines?.length
        ? c.data.lines.map((l) => ({ description: l.description, amount: l.amount }))
        : [{ description: '', amount: '' }],
    );
    setAmountReturned(String(c.data.amountReturned ?? 0));
    const a = await api.get(`/api/v1/activities/${c.data.activityId}`);
    setActivity(a.data);
  }

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err, 'Could not open this accountability.')));
  }, [id]);

  useEffect(() => {
    if (!isReviewer) return;
    api
      .get(`${ACCOUNTABILITY_API}/reviewers`)
      .then((res) => setReviewers(unwrap(res.data)))
      .catch(() => setReviewers([]));
  }, [isReviewer]);

  const participants = Array.isArray(activity?.participants) ? activity.participants : [];
  const editable = row?.status === 'draft' || row?.status === 'returned';
  const openClarification = (row?.clarifications || []).find((c) => c.status === 'open');

  async function run(action, success) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      if (success) setNotice(success);
    } catch (err) {
      setError(errorMessage(err, 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  if (!row && !error) return <p className="text-sm text-ink-500">Opening accountability…</p>;
  if (error && !row) {
    return (
      <div>
        <p className="text-sm text-rose-700">{error}</p>
        <Link to="/accountability" className="ams-btn-secondary mt-4 inline-flex">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Accountability case"
        title={row.referenceNumber}
        subtitle={`${row.activity?.title || activity?.title || 'Activity'} · Due ${formatDate(row.dueDate)}${
          row.overdue ? ' · Overdue' : ''
        }`}
        actions={<StatusPill status={row.status} />}
      />

      {notice ? <div className="mb-6 rounded-2xl bg-teal-100 p-4 text-sm text-teal-900">{notice}</div> : null}
      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-ink-600">
        Next: {nextActionLabel(row)} · Who must act: {row.nextActor || '—'}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="ams-card lg:col-span-2 space-y-4">
          <h2 className="font-display text-xl">Case summary</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <Item label="Activity" value={row.activity?.title || '—'} />
            <Item label="Department" value={row.activity?.departmentName || activity?.departmentName || '—'} />
            <Item label="Amount advanced" value={formatMoney(row.amountAdvanced)} />
            <Item label="Amount accounted" value={formatMoney(row.amountAccounted)} />
            <Item label="Amount returned" value={formatMoney(row.amountReturned)} />
            <Item label="Outstanding" value={formatMoney(row.outstandingBalance)} />
            <Item label="Submitted by" value={row.submittedById} />
            <Item
              label="Responsible Person"
              value={
                row.personId ? (
                  <Link to={`/persons/${row.personId}`} className="font-medium text-teal-800 underline">
                    Open Person
                  </Link>
                ) : (
                  'Not linked'
                )
              }
            />
            <Item label="Assigned reviewer" value={row.reviewerId || 'Unassigned'} />
          </div>

          <h2 className="pt-2 font-display text-xl">Financial details</h2>
          {editable && isOfficer ? (
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded-xl border border-ink-100 px-3 py-2 text-sm"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, description: e.target.value } : l)))
                    }
                  />
                  <input
                    className="w-28 rounded-xl border border-ink-100 px-3 py-2 text-sm"
                    placeholder="Amount"
                    value={line.amount}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, amount: e.target.value } : l)))
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="ams-btn-ghost"
                onClick={() => setLines((prev) => [...prev, { description: '', amount: '' }])}
              >
                Add line
              </button>
              <label className="block text-sm">
                Amount returned
                <input
                  className="mt-1 w-40 rounded-xl border border-ink-100 px-3 py-2 text-sm"
                  value={amountReturned}
                  onChange={(e) => setAmountReturned(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="ams-btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.patch(`${ACCOUNTABILITY_API}/${id}`, {
                        amountReturned: Number(amountReturned) || 0,
                        lines: lines
                          .filter((l) => String(l.description).trim())
                          .map((l) => ({ description: l.description, amount: Number(l.amount) || 0 })),
                      }),
                    'Financial details saved.',
                  )
                }
              >
                Save financial details
              </button>
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {(row.lines || []).map((l) => (
                <li key={l.id}>
                  {l.description}: {formatMoney(l.amount)}
                </li>
              ))}
              {(row.lines || []).length === 0 ? <li>No expenditure lines yet.</li> : null}
            </ul>
          )}

          <h2 className="pt-2 font-display text-xl">Participants</h2>
          {participants.length === 0 ? (
            <p className="text-sm text-ink-500">No participants on the linked activity.</p>
          ) : (
            participants.map((p, i) => (
              <p key={p.id || i} className="text-sm">
                {p.name} · {p.title || '—'} · {formatMoney(p.amount)}
              </p>
            ))
          )}

          <h2 className="pt-2 font-display text-xl">Supporting documents</h2>
          {(row.documents || []).length === 0 ? (
            <p className="text-sm text-ink-500">No accountability documents attached yet.</p>
          ) : (
            (row.documents || []).map((d) => (
              <p key={d.id} className="text-sm">
                <a className="font-medium text-teal-800 underline" href={d.storedPath} target="_blank" rel="noreferrer">
                  {d.originalName}
                </a>
              </p>
            ))
          )}
          {row.activity?.hasActivityReport ? (
            <p className="text-sm text-ink-500">An activity report exists on the activity. It is not this case’s supporting pack.</p>
          ) : null}
          {editable && isOfficer ? (
            <div className="space-y-2">
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button
                type="button"
                className="ams-btn-secondary"
                disabled={busy}
                onClick={() => {
                  const fileError = validateReportFile(file);
                  if (fileError) {
                    setError(fileError);
                    return;
                  }
                  const form = new FormData();
                  form.append('document', file);
                  return run(
                    () =>
                      api.post(`${ACCOUNTABILITY_API}/${id}/documents`, form, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      }),
                    'Supporting document attached.',
                  );
                }}
              >
                Attach document
              </button>
            </div>
          ) : null}

          {(row.comments || []).length ? (
            <>
              <h2 className="pt-2 font-display text-xl">Comments and reasons</h2>
              {(row.comments || []).map((c) => (
                <p key={c.id} className="text-sm text-ink-700">
                  {c.kind}: {c.body} · {formatDate(c.createdAt)}
                </p>
              ))}
            </>
          ) : null}

          {(row.clarifications || []).length ? (
            <>
              <h2 className="pt-2 font-display text-xl">Clarifications</h2>
              {(row.clarifications || []).map((c) => (
                <div key={c.id} className="rounded-xl bg-ink-50 p-3 text-sm">
                  <p>Q: {c.question}</p>
                  <p className="mt-1 text-ink-500">{c.response ? `A: ${c.response}` : 'Awaiting response'}</p>
                </div>
              ))}
            </>
          ) : null}

          <details>
            <summary className="cursor-pointer text-sm font-semibold text-teal-800">Review history / timeline</summary>
            <div className="mt-3 space-y-2">
              {timeline.length === 0 ? (
                <p className="text-sm text-ink-500">No timeline events yet.</p>
              ) : (
                timeline.map((event) => (
                  <p key={event.id} className="text-sm text-ink-700">
                    {event.summary || event.action} · {formatDate(event.createdAt)}
                  </p>
                ))
              )}
            </div>
          </details>
        </section>

        <div className="space-y-4">
          {row.status === 'draft' && isOfficer ? (
            <NextAction title="Submit this case" body="Financial lines and evidence are required. Submission starts review; it is not approval.">
              <button
                type="button"
                className="ams-btn-primary"
                disabled={busy}
                onClick={() => run(() => api.post(`${ACCOUNTABILITY_API}/${id}/submit`), 'Submitted for review.')}
              >
                Submit
              </button>
            </NextAction>
          ) : null}

          {row.status === 'returned' && isOfficer ? (
            <NextAction title="Correct and resubmit" body={row.returnReason ? `Returned because: ${row.returnReason}` : 'This case was returned for correction.'}>
              <button
                type="button"
                className="ams-btn-primary"
                disabled={busy}
                onClick={() => run(() => api.post(`${ACCOUNTABILITY_API}/${id}/resubmit`), 'Resubmitted for review.')}
              >
                Resubmit
              </button>
            </NextAction>
          ) : null}

          {row.status === 'clarification_requested' && isOfficer && openClarification ? (
            <NextAction title="Answer the clarification" body={openClarification.question}>
              <textarea
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm"
                rows={3}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
              />
              <button
                type="button"
                className="ams-btn-primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.post(`${ACCOUNTABILITY_API}/${id}/clarification/${openClarification.id}/respond`, {
                        response,
                      }),
                    'Clarification answered.',
                  )
                }
              >
                Send response
              </button>
            </NextAction>
          ) : null}

          {isReviewer && (row.status === 'submitted' || row.status === 'resubmitted' || row.status === 'under_review') ? (
            <NextAction title="Assign reviewer" body="Role permission is not the same as case assignment.">
              <select
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm"
                value={reviewerId || row.reviewerId || user?.id || ''}
                onChange={(e) => setReviewerId(e.target.value)}
              >
                <option value="">Select reviewer</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                {reviewers.length === 0 && user?.id ? <option value={user.id}>{user.name || 'Me'}</option> : null}
              </select>
              <button
                type="button"
                className="ams-btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.post(`${ACCOUNTABILITY_API}/${id}/assign`, { reviewerId: reviewerId || user?.id }),
                    'Reviewer assigned.',
                  )
                }
              >
                Assign
              </button>
            </NextAction>
          ) : null}

          {isReviewer && row.status === 'under_review' ? (
            <NextAction title="Review decision" body="Approval does not close the case. Return and clarification are different actions.">
              <textarea
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm"
                rows={3}
                placeholder="Reason (required for return or reject)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm"
                placeholder="Clarification question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button
                type="button"
                className="ams-btn-primary"
                disabled={busy}
                onClick={() => run(() => api.post(`${ACCOUNTABILITY_API}/${id}/approve`, { note: reason }), 'Approved.')}
              >
                Approve
              </button>
              <button
                type="button"
                className="ams-btn-secondary"
                disabled={busy}
                onClick={() => run(() => api.post(`${ACCOUNTABILITY_API}/${id}/return`, { reason }), 'Returned for correction.')}
              >
                Return
              </button>
              <button
                type="button"
                className="ams-btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(() => api.post(`${ACCOUNTABILITY_API}/${id}/clarification`, { question }), 'Clarification requested.')
                }
              >
                Request clarification
              </button>
              <button
                type="button"
                className="ams-btn-ghost"
                disabled={busy}
                onClick={() => run(() => api.post(`${ACCOUNTABILITY_API}/${id}/reject`, { reason }), 'Rejected.')}
              >
                Reject
              </button>
            </NextAction>
          ) : null}

          {isReviewer && row.status === 'approved' ? (
            <NextAction title="Close this case" body="Closure is administrative. The case becomes immutable.">
              <textarea
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm"
                rows={2}
                placeholder="Closure reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="button"
                className="ams-btn-primary"
                disabled={busy}
                onClick={() => run(() => api.post(`${ACCOUNTABILITY_API}/${id}/close`, { reason }), 'Closed.')}
              >
                Close
              </button>
            </NextAction>
          ) : null}

          <Link to={`/activities/${row.activityId}`} className="ams-btn-ghost w-full text-center">
            View activity
          </Link>
          <button type="button" className="ams-btn-ghost w-full" onClick={() => navigate('/accountability')}>
            Back to queue
          </button>
        </div>
      </div>
    </div>
  );
}

function unwrap(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function nextActionLabel(row) {
  const map = {
    draft: 'Complete financial details and submit',
    submitted: 'Assign a reviewer',
    under_review: 'Reviewer decides',
    returned: 'Correct and resubmit',
    clarification_requested: 'Answer the clarification',
    resubmitted: 'Reviewer continues',
    approved: 'Close the case',
    rejected: 'No further action',
    closed: 'Case is closed',
  };
  return map[row.status] || 'See status';
}

function Item({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-ink-900">{value}</p>
    </div>
  );
}
