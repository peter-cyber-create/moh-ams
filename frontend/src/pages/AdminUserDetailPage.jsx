import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import PasswordInput from '../components/PasswordInput';
import { formatDate, roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { ACCESS_ROLE_HINTS, ADMIN_API, validatePasswordPair } from '../lib/admin';
import { useAuth } from '../lib/AuthContext';

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isAdmin } = roleProfile(user);
  const location = useLocation();
  const [row, setRow] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [edit, setEdit] = useState({ name: '', phone: '', departmentId: '', accessRole: 'Officer' });
  const [reset, setReset] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    return api
      .get(`${ADMIN_API}/users/${id}`)
      .then((res) => {
        setRow(res.data);
        setEdit({
          name: res.data.name || '',
          phone: res.data.phone || '',
          departmentId: res.data.departmentId || '',
          accessRole: res.data.accessRole || 'Officer',
        });
      })
      .catch((err) => setError(errorMessage(err, 'Could not load user.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
    api
      .get(`${ADMIN_API}/departments`)
      .then((res) => setDepartments(res.data?.data || res.data || []))
      .catch(() => setDepartments([]));
  }, [isAdmin, id]);

  if (!isAdmin) {
    return <EmptyState title="User management is limited to administrators." action={<Link to="/">Home</Link>} />;
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!row) return;
    const roleChanging = edit.accessRole !== row.accessRole;
    if (roleChanging) {
      const ok = window.confirm(
        `Change role for ${row.name}?\n\nCurrent role: ${row.accessRole}\nNew role: ${edit.accessRole}`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.patch(`${ADMIN_API}/users/${id}`, {
        name: edit.name,
        phone: edit.phone || null,
        departmentId: edit.departmentId || null,
        accessRole: edit.accessRole,
        confirmRoleChange: roleChanging,
      });
      setRow(res.data);
      setNotice('Changes saved.');
    } catch (err) {
      setError(errorMessage(err, 'Could not save changes.'));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!window.confirm('Deactivate this account?\n\nThis user will no longer be able to sign in.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`${ADMIN_API}/users/${id}/deactivate`);
      setRow(res.data);
      setNotice('Account deactivated.');
    } catch (err) {
      setError(errorMessage(err, 'Could not deactivate the account.'));
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    if (!window.confirm('Reactivate this account?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`${ADMIN_API}/users/${id}/reactivate`);
      setRow(res.data);
      setNotice('Account reactivated.');
    } catch (err) {
      setError(errorMessage(err, 'Could not reactivate the account.'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    const pairErr = validatePasswordPair(reset.password, reset.confirmPassword);
    if (pairErr) {
      setError(pairErr);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`${ADMIN_API}/users/${id}/reset-password`, reset);
      setReset({ password: '', confirmPassword: '' });
      setNotice('Password reset.');
    } catch (err) {
      setError(errorMessage(err, 'Could not reset password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={row?.name || 'User'}
        subtitle="Account details and access."
        actions={
          <Link to="/admin/users" className="ams-btn-secondary">
            All users
          </Link>
        }
      />
      {loading ? <p className="text-sm text-ink-500">Loading users…</p> : null}
      {error ? (
        <p className="mb-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="mb-3 text-sm text-teal-800">{notice}</p> : null}

      {row ? (
        <>
          <div className="mb-6 space-y-2 rounded-lg bg-white px-4 py-4 text-sm text-ink-700 shadow-ams">
            <p>
              <span className="font-semibold text-ink-900">Email:</span> {row.email}
            </p>
            <p>
              <span className="font-semibold text-ink-900">Status:</span> {row.status}
            </p>
            <p>
              <span className="font-semibold text-ink-900">Role:</span> {row.accessRole}
            </p>
            <p>
              <span className="font-semibold text-ink-900">Created:</span> {formatDate(row.createdAt) || '—'}
            </p>
            <p>
              <span className="font-semibold text-ink-900">Linked Person:</span>{' '}
              {row.person ? (
                <Link to={`/persons/${row.person.id}`} className="font-semibold text-teal-800">
                  {row.person.personReference} · {row.person.name}
                </Link>
              ) : (
                'Not linked to a Person'
              )}
            </p>
          </div>

          <form onSubmit={saveProfile} className="mb-8 space-y-3 rounded-lg bg-white px-4 py-4 shadow-ams">
            <h2 className="font-display text-lg text-ink-900">Edit</h2>
            <div>
              <label className="ams-label">Full name</label>
              <input className="ams-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <label className="ams-label">Phone</label>
              <input className="ams-input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </div>
            <div>
              <label className="ams-label">Department</label>
              <select
                className="ams-input"
                value={edit.departmentId}
                onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ams-label">Role</label>
              <select
                className="ams-input"
                value={edit.accessRole}
                onChange={(e) => setEdit({ ...edit, accessRole: e.target.value })}
              >
                <option value="Officer">Officer</option>
                <option value="Reviewer">Reviewer</option>
                <option value="Administrator">Administrator</option>
              </select>
              <p className="mt-1 text-sm text-ink-500">{ACCESS_ROLE_HINTS[edit.accessRole]}</p>
            </div>
            <button type="submit" className="ams-btn-primary" disabled={busy}>
              {busy ? 'Saving changes…' : 'Save changes'}
            </button>
          </form>

          <div className="mb-8 flex flex-wrap gap-2">
            {row.isActive ? (
              <button type="button" className="ams-btn-secondary" onClick={deactivate} disabled={busy}>
                Deactivate
              </button>
            ) : (
              <button type="button" className="ams-btn-primary" onClick={reactivate} disabled={busy}>
                Reactivate
              </button>
            )}
          </div>

          <form onSubmit={resetPassword} className="space-y-3 rounded-lg bg-white px-4 py-4 shadow-ams">
            <h2 className="font-display text-lg text-ink-900">Reset password</h2>
            <p className="text-sm text-ink-500">Administrators can set a new password. Existing passwords cannot be viewed.</p>
            <PasswordInput
              label="New password"
              value={reset.password}
              onChange={(e) => setReset({ ...reset, password: e.target.value })}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirm password"
              value={reset.confirmPassword}
              onChange={(e) => setReset({ ...reset, confirmPassword: e.target.value })}
              autoComplete="new-password"
            />
            <button type="submit" className="ams-btn-secondary" disabled={busy}>
              Reset password
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
