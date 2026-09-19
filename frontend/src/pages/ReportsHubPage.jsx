import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { formatDate, formatMoney, unwrapList } from '../lib/ams';
import api, { errorMessage } from '../lib/api';

/** Compact report centre — four categories. */
export const REPORT_CATEGORIES = [
  {
    id: 'activities',
    title: 'Activities',
    description: 'Activity dates and operational activity information.',
    reports: [
      { id: 'activities', title: 'Activity Register', endpoint: '/api/v1/reports/activities', hint: 'Activities by date' },
      {
        id: 'missing-report',
        title: 'Activities missing a report file',
        endpoint: '/api/v1/reports/missing-report',
        hint: 'Activity report queue — not Accountability',
      },
    ],
  },
  {
    id: 'people',
    title: 'People',
    description: 'Participation and person activity history.',
    reports: [
      { id: 'person', title: 'Participation by Person', endpoint: '/api/v1/reports/person' },
      { id: 'matrix', title: 'Activity per Person', endpoint: '/api/v1/reports/participant-activity' },
    ],
  },
  {
    id: 'financial',
    title: 'Financial',
    description: 'Funding and financial amounts.',
    reports: [
      { id: 'funding', title: 'Funding & Amounts', endpoint: '/api/v1/reports/funding' },
      { id: 'amounts', title: 'Amounts by user', endpoint: '/api/v1/reports/amounts' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    description: 'Participation limits, accountabilities and overlaps.',
    reports: [
      {
        id: 'limits',
        title: 'Participation Limits',
        href: '/compliance?tab=participation',
      },
      {
        id: 'pending-acc',
        title: 'Accountability Status',
        href: '/compliance?tab=accountabilities',
      },
      {
        id: 'overlaps',
        title: 'Activity Overlaps',
        href: '/compliance?tab=overlaps',
      },
      {
        id: 'flagged',
        title: 'Participants at 150+ days',
        endpoint: '/api/v1/reports/flagged',
      },
    ],
  },
];

export default function ReportsHubPage() {
  const [params] = useSearchParams();
  const categoryId = params.get('category');
  const category = REPORT_CATEGORIES.find((c) => c.id === categoryId);

  if (category) {
    return (
      <div>
        <PageHeader
          eyebrow="Reports"
          title={category.title}
          subtitle={category.description}
          actions={
            <Link to="/reports" className="ams-btn-secondary">
              All categories
            </Link>
          }
        />
        <ul className="space-y-3">
          {category.reports.map((r) => (
            <li key={r.id} className="ams-card">
              <Link
                className="block font-semibold text-teal-800"
                to={r.href || `/reports/${r.id}`}
              >
                {r.title}
              </Link>
              {r.hint ? <p className="mt-1 text-sm text-ink-500">{r.hint}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Choose what you want to review." />
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_CATEGORIES.map((cat) => (
          <Link key={cat.id} to={`/reports?category=${cat.id}`} className="block rounded-lg bg-white px-4 py-4 shadow-ams hover:ring-1 hover:ring-teal-800">
            <h2 className="font-display text-xl text-ink-900">{cat.title}</h2>
            <p className="mt-1 text-sm text-ink-500">{cat.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ReportViewPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const meta = REPORT_CATEGORIES.flatMap((c) => c.reports).find((r) => r.id === reportId && r.endpoint);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta?.endpoint) return;
    setLoading(true);
    api
      .get(meta.endpoint)
      .then((res) => setRows(unwrapList(res.data)))
      .catch((err) => setError(errorMessage(err, 'Could not load this report.')))
      .finally(() => setLoading(false));
  }, [meta]);

  if (!meta) {
    return <EmptyState title="Report not found" action={<Link to="/reports">Back to reports</Link>} />;
  }

  function exportCsv() {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title={meta.title}
        subtitle={meta.hint}
        actions={
          <>
            <button type="button" className="ams-btn-secondary no-print" onClick={() => navigate('/reports')}>
              Reports
            </button>
            <button type="button" className="ams-btn-secondary no-print" onClick={exportCsv} disabled={!rows.length}>
              Export
            </button>
          </>
        }
      />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-ink-500">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState title="No rows" body="This report has no records." />
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 200).map((row, idx) => (
            <li key={row.id || idx} className="ams-card text-sm">
              <p className="font-semibold">{row.activityName || row.title || row.name || row.activity || 'Record'}</p>
              <p className="mt-1 text-ink-500">
                {row.dept || row.department?.name || row.funder || row.phone || ''}{' '}
                {row.invoiceDate ? `· ${formatDate(row.invoiceDate)}` : ''}{' '}
                {row.amt != null || row.amount != null || row.totalAmount != null
                  ? `· ${formatMoney(row.amt ?? row.amount ?? row.totalAmount)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
