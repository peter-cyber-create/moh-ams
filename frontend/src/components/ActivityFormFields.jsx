import { FUNDERS } from '../lib/registerActivity';

export function ActivityFormFields({ form, onChange }) {
  function update(field, value) {
    onChange({ ...form, [field]: value });
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Activity information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Activity title" value={form.activityName} onChange={(v) => update('activityName', v)} required />
          <Field label="Department" value={form.dept} onChange={(v) => update('dept', v)} required />
          <Field label="Requested by" value={form.requestedBy} onChange={(v) => update('requestedBy', v)} required />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Dates</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="ams-label">Start date *</label>
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
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">Field days are counted automatically from these dates.</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Location</h3>
        <Field label="Location" value={form.location} onChange={(v) => update('location', v)} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Funding</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="ams-label">Funder *</label>
            <select className="ams-input" value={form.funder} onChange={(e) => update('funder', e.target.value)}>
              <option value="">Select</option>
              {FUNDERS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <Field label="Amount" value={form.amt} onChange={(v) => update('amt', v)} required />
          <Field label="Reference / voucher" value={form.vocherno} onChange={(v) => update('vocherno', v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Description</h3>
        <textarea
          className="ams-input min-h-[4rem]"
          value={form.description || ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Optional notes"
        />
      </section>
    </div>
  );
}

function Field({ label, value, onChange, required }) {
  return (
    <div>
      <label className="ams-label">
        {label}
        {required ? ' *' : ''}
      </label>
      <input className="ams-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
