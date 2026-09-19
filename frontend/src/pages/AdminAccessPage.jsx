import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { ADMIN_API } from '../lib/admin';
import { useAuth } from '../lib/AuthContext';

export default function AdminAccessPage() {
  const { user } = useAuth();
  const { isAdmin } = roleProfile(user);
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get(`${ADMIN_API}/access-matrix`)
      .then((res) => setMatrix(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not load access information.')))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return <EmptyState title="Access information is limited to administrators." action={<Link to="/">Home</Link>} />;
  }

  return (
    <div>
      <PageHeader
        title="Roles & access"
        subtitle="How AMS roles map to everyday work."
        actions={
          <Link to="/admin" className="ams-btn-secondary">
            Administration
          </Link>
        }
      />
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-ink-500">Checking access…</p> : null}
      {matrix?.roles ? (
        <ul className="mb-6 space-y-2">
          {matrix.roles.map((r) => (
            <li key={r.key} className="rounded-lg bg-white px-4 py-3 shadow-ams">
              <p className="font-semibold text-ink-900">{r.label}</p>
              <p className="text-sm text-ink-600">{r.description}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {matrix?.data ? (
        <div className="overflow-x-auto rounded-lg bg-white shadow-ams">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-ink-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Function</th>
                <th className="px-3 py-2 font-semibold">Officer</th>
                <th className="px-3 py-2 font-semibold">Reviewer</th>
                <th className="px-3 py-2 font-semibold">Administrator</th>
              </tr>
            </thead>
            <tbody>
              {matrix.data.map((row) => (
                <tr key={row.function} className="border-b border-ink-50">
                  <td className="px-3 py-2 text-ink-900">{row.function}</td>
                  <td className="px-3 py-2">{row.officer}</td>
                  <td className="px-3 py-2">{row.reviewer}</td>
                  <td className="px-3 py-2">{row.administrator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
