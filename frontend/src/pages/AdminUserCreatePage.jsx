import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import PasswordInput from '../components/PasswordInput';
import { roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { ACCESS_ROLE_HINTS, ADMIN_API, validatePasswordPair } from '../lib/admin';
import { useAuth } from '../lib/AuthContext';

export default function AdminUserCreatePage() {
  const { user } = useAuth();
  const { isAdmin } = roleProfile(user);
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    departmentId: '',
    accessRole: 'Officer',
    password: '',
    confirmPassword: '',
    status: 'Active',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get(`${ADMIN_API}/departments`)
      .then((res) => setDepartments(res.data?.data || res.data || []))
      .catch(() => setDepartments([]));
  }, [isAdmin]);

  if (!isAdmin) {
    return <EmptyState title="User management is limited to administrators." action={<Link to="/">Home</Link>} />;
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const pairErr = validatePasswordPair(form.password, form.confirmPassword);
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (pairErr) {
      setError(pairErr);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`${ADMIN_API}/users`, {
        ...form,
        departmentId: form.departmentId || undefined,
        phone: form.phone || undefined,
      });
      navigate(`/admin/users/${res.data.id}`, { replace: true, state: { notice: 'Account created.' } });
    } catch (err) {
      setError(errorMessage(err, 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add user" subtitle="Create an AMS sign-in account." />
      <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 rounded-lg bg-white px-4 py-5 shadow-ams" noValidate>
        <div>
          <label className="ams-label" htmlFor="name">
            Full name
          </label>
          <input id="name" className="ams-input" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        </div>
        <div>
          <label className="ams-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="ams-input"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="ams-label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" className="ams-input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
        </div>
        <div>
          <label className="ams-label" htmlFor="departmentId">
            Department
          </label>
          <select
            id="departmentId"
            className="ams-input"
            value={form.departmentId}
            onChange={(e) => setField('departmentId', e.target.value)}
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
          <label className="ams-label" htmlFor="accessRole">
            Role
          </label>
          <select
            id="accessRole"
            className="ams-input"
            value={form.accessRole}
            onChange={(e) => setField('accessRole', e.target.value)}
          >
            <option value="Officer">Officer</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Administrator">Administrator</option>
          </select>
          <p className="mt-1 text-sm text-ink-500">{ACCESS_ROLE_HINTS[form.accessRole]}</p>
        </div>
        <div>
          <label className="ams-label" htmlFor="status">
            Status
          </label>
          <select id="status" className="ams-input" value={form.status} onChange={(e) => setField('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          label="Confirm password"
          value={form.confirmPassword}
          onChange={(e) => setField('confirmPassword', e.target.value)}
          autoComplete="new-password"
          required
        />
        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="ams-btn-primary" disabled={busy}>
            {busy ? 'Creating account…' : 'Create user'}
          </button>
          <Link to="/admin/users" className="ams-btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
