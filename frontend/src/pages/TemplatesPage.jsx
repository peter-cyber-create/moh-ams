import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { downloadTemplate, TEMPLATE_DOWNLOADS } from '../lib/templates';

export default function TemplatesPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onDownload() {
    setError('');
    setBusy(true);
    try {
      await downloadTemplate(TEMPLATE_DOWNLOADS.participants, 'AMS_Participant_List_Template.xlsx');
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activities"
        title="Templates"
        subtitle="Download the Participant List spreadsheet for Activity upload. Activity information is entered in the AMS form."
        actions={
          <Link to="/activities/register" className="ams-btn-primary">
            + New activity
          </Link>
        }
      />
      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ams-card max-w-xl">
        <h2 className="font-display text-xl">Participant List</h2>
        <p className="mt-1 text-sm text-ink-500">
          Prepare participant information for an Activity. Columns: Name, Title, Organisation, Phone, Amount.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wide text-ink-500">File type: .xlsx</p>
        <button type="button" className="ams-btn-secondary mt-4" disabled={busy} onClick={onDownload}>
          {busy ? 'Downloading…' : 'Download Excel Template'}
        </button>
      </div>
    </div>
  );
}
