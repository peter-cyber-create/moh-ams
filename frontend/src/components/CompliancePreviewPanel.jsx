import { humanResultLabel, humanizeWarning, warningLevel } from '../lib/warnings';

export function CompliancePreviewPanel({ preview, loading, error, onChangeDates, startDate, endDate }) {
  if (loading) return <p className="text-sm text-ink-500">Checking field days and accountabilities…</p>;
  if (error) {
    return (
      <p className="text-sm text-rose-700" role="alert">
        {error}
      </p>
    );
  }
  if (!preview) {
    return <p className="text-sm text-ink-500">Add dates and participants to run the compliance check.</p>;
  }

  const warnings = (preview.warnings || []).map(humanizeWarning).filter(Boolean);
  const hasIssues = warnings.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg text-ink-900">Activity summary</h3>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-500">Title</dt>
            <dd className="font-medium">{preview.title || '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Dates</dt>
            <dd className="font-medium">
              {startDate || '—'}
              {endDate ? ` → ${endDate}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Duration</dt>
            <dd className="font-medium">{preview.durationDays ?? '—'} field day(s)</dd>
          </div>
          <div>
            <dt className="text-ink-500">Participants</dt>
            <dd className="font-medium">{preview.participantCount ?? 0}</dd>
          </div>
        </dl>
      </div>

      {onChangeDates ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ams-label">Start date</label>
            <input
              type="date"
              className="ams-input"
              value={startDate || ''}
              onChange={(e) => onChangeDates({ start: e.target.value, end: endDate })}
            />
          </div>
          <div>
            <label className="ams-label">End date</label>
            <input
              type="date"
              className="ams-input"
              value={endDate || ''}
              onChange={(e) => onChangeDates({ start: startDate, end: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-500">Changing dates updates this check immediately.</p>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="font-display text-lg text-ink-900">Compliance check</h3>
        <p className="mt-1 text-sm text-ink-500">
          Warnings help you review. They do not automatically block submission.
        </p>
        {!hasIssues ? (
          <p className="mt-3 text-sm font-semibold text-teal-800">✓ No major issues for this activity.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {warnings.map((w, i) => {
              const level = warningLevel(w);
              const cls =
                level === 'action'
                  ? 'border-l-4 border-l-rose-600 bg-rose-50 text-rose-950'
                  : level === 'warning'
                    ? 'border-l-4 border-l-amber-500 bg-amber-50 text-amber-950'
                    : 'border-l-4 border-l-ink-300 bg-paper text-ink-800';
              const mark = level === 'action' ? '●' : level === 'warning' ? '⚠' : '•';
              return (
                <li key={i} className={`rounded-r-lg px-3 py-2 text-sm ${cls}`}>
                  <span className="mr-2 font-semibold" aria-hidden>
                    {mark}
                  </span>
                  {w}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(preview.participants || []).length ? (
        <div className="overflow-x-auto rounded-lg border border-ink-100">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-paper text-ink-500">
                <th className="px-3 py-2 font-semibold">Participant</th>
                <th className="px-3 py-2 font-semibold">Month</th>
                <th className="px-3 py-2 font-semibold">Annual</th>
                <th className="px-3 py-2 font-semibold">Accountability</th>
                <th className="px-3 py-2 font-semibold">Overlap</th>
                <th className="px-3 py-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {(preview.participants || []).map((p, i) => (
                <tr key={p.personId || `${p.name}-${i}`} className="border-t border-ink-100">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">
                    {p.currentMonthDays} → {p.projectedMonthDays}
                  </td>
                  <td className="px-3 py-2">
                    {p.currentAnnualDays} → {p.projectedAnnualDays}
                  </td>
                  <td className="px-3 py-2">{humanResultLabel(p.accountability?.status || 'clear')}</td>
                  <td className="px-3 py-2">{p.overlap ? 'Yes' : p.potentialOverlap ? 'Possible' : 'No'}</td>
                  <td className="px-3 py-2">{humanResultLabel(p.result || p.overallLabel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
