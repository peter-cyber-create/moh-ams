import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { ADMIN_API } from '../lib/admin';
import { useAuth } from '../lib/AuthContext';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { isAdmin } = roleProfile(user);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .get(`${ADMIN_API}/users`, { params: { search: search || undefined, role: role || undefined, status: status || undefined, limit: 50 } })
      .then((res) => {
        if (!cancelled) setRows(res.data?.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load users.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, search, role, status]);

  if (!isAdmin) {
    return <EmptyState title="User management is limited to administrators." action={<Link to="/">Home</Link>} />;
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="AMS user accounts and roles."
        actions={
          <Link to="/admin/users/new" className="ams-btn-primary">
            + Add User
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="ams-input max-w-xs"
          placeholder="Search users"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="ams-input max-w-[10rem]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="Officer">Officer</option>
          <option value="Reviewer">Reviewer</option>
          <option value="Administrator">Administrator</option>
        </select>
        <select className="ams-input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-ink-500">Loading users…</p> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          title="No users found"
          body="Create an account to get started."
          action={
            <Link to="/admin/users/new" className="ams-btn-primary">
              + Add User
            </Link>
          }
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto rounded-lg bg-white shadow-ams md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Department</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-ink-50">
                    <td className="px-3 py-2 font-medium text-ink-900">{u.name}</td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2">{u.accessRole}</td>
                    <td className="px-3 py-2">{u.departmentName || '—'}</td>
                    <td className="px-3 py-2">{u.status}</td>
                    <td className="px-3 py-2">
                      <Link to={`/admin/users/${u.id}`} className="font-semibold text-teal-800">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((u) => (
              <li key={u.id} className="rounded-lg bg-white px-4 py-3 shadow-ams">
                <Link to={`/admin/users/${u.id}`} className="block">
                  <span className="font-semibold text-ink-900">{u.name}</span>
                  <span className="mt-0.5 block text-sm text-ink-500">
                    {u.accessRole} · {u.status}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-500">{u.email}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
