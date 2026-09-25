import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';
import { AMS_VERSION } from '../lib/ams';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    params.get('session') === 'expired' ? 'Your session expired. Please sign in again.' : '',
  );
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError('Enter your username or email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(loginId.trim(), password);
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
        <header className="mb-10 text-center">
          <img
            src={`${import.meta.env.BASE_URL}branding/uganda-coat-of-arms.png`}
            alt="Coat of Arms of the Republic of Uganda"
            className="mx-auto h-28 w-auto object-contain"
          />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-500">
            Republic of Uganda
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">Ministry of Health</h1>
          <p className="mt-1 text-base font-medium text-teal-800">Activities Management System</p>
          <p className="mt-2 text-xs text-ink-500">Version {AMS_VERSION}</p>
        </header>

        <form onSubmit={onSubmit} className="ams-card space-y-5" noValidate>
          <h2 className="font-display text-2xl text-ink-900">Sign in</h2>
          <div>
            <label className="ams-label" htmlFor="loginId">
              Username / Email
            </label>
            <input
              id="loginId"
              className="ams-input"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </div>
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="ams-btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="font-medium text-teal-800 underline">
              Forgot password
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
