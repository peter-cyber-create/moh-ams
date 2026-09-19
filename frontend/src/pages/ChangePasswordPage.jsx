import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import PasswordInput from '../components/PasswordInput';
import api, { errorMessage } from '../lib/api';
import { validatePasswordPair } from '../lib/admin';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const pairErr = validatePasswordPair(newPassword, confirmPassword);
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (pairErr) {
      setError(pairErr);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setNotice('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(errorMessage(err, 'Your password could not be changed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Change password" subtitle="Update the password for your AMS sign-in." />
      <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-lg bg-white px-4 py-5 shadow-ams" noValidate>
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          label="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="text-sm text-teal-800">{notice}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="ams-btn-primary" disabled={busy}>
            {busy ? 'Changing password…' : 'Change password'}
          </button>
          <Link to="/profile" className="ams-btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
