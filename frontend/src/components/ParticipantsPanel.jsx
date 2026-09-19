export function ParticipantsPanel({
  rows,
  importSummary,
  onDownloadTemplate,
  onUpload,
  onAddManual,
  onRemoveRow,
  onCopyNote,
}) {
  const ready = importSummary?.valid ?? rows.length;
  const rejected = importSummary?.rejected ?? 0;
  const duplicates = importSummary?.duplicates ?? 0;
  const missing = importSummary?.missingIdentity ?? 0;
  const issues = rejected + duplicates;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700">Add the people taking part in this activity.</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="ams-btn-primary cursor-pointer">
          Upload participant list
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
        {onAddManual ? (
          <button type="button" className="ams-btn-secondary" onClick={onAddManual}>
            + Add participant
          </button>
        ) : null}
      </div>

      <p className="text-sm text-ink-500">
        Need the Excel format?{' '}
        <button type="button" className="font-semibold text-teal-800 underline" onClick={onDownloadTemplate}>
          Download participant template
        </button>
      </p>

      {onCopyNote ? <div className="text-sm text-ink-500">{onCopyNote}</div> : null}

      {importSummary ? (
        <div className="rounded-lg border border-ink-100 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-ink-900">
            Participant list · {importSummary.total} row{importSummary.total === 1 ? '' : 's'} found
          </p>
          <ul className="mt-2 space-y-1 text-ink-700">
            <li>✓ {ready} ready</li>
            {missing ? <li>⚠ {missing} need review (no phone)</li> : null}
            {duplicates ? <li>⚠ {duplicates} duplicate</li> : null}
            {rejected ? <li>⚠ {rejected} rejected</li> : null}
          </ul>
          {issues ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold text-teal-800">View issues</summary>
              <ul className="mt-2 space-y-1 text-rose-700">
                {(importSummary.reasons || []).map((r, i) => (
                  <li key={i}>
                    Row {r.row}: {r.reason}
                    {r.name ? ` (${r.name})` : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-semibold text-ink-800">Participants: {rows.length}</p>
      )}

      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-ink-100">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-paper text-ink-500">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Title / org</th>
                <th className="px-3 py-2 font-semibold">Phone</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                {onRemoveRow ? <th className="px-3 py-2"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-ink-100">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.title || '—'}</td>
                  <td className="px-3 py-2">{r.phone || '—'}</td>
                  <td className="px-3 py-2">{r.amount}</td>
                  {onRemoveRow ? (
                    <td className="px-3 py-2">
                      <button type="button" className="text-sm text-rose-700" onClick={() => onRemoveRow(r.key)}>
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink-500">No participants yet. Upload a list or add one person.</p>
      )}
    </div>
  );
}
