import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { AMS_VERSION, roleProfile } from '../lib/ams';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function SystemPage() {
  const { user } = useAuth();
  const { isAdmin } = roleProfile(user);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get('/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not reach the AMS service.')));
  }, [isAdmin]);

  if (!isAdmin) {
    return <EmptyState title="System status is limited to administrators." action={<Link to="/">Dashboard</Link>} />;
  }

  const online = health?.status === 'ok';
  const databaseOk = health?.database ? health.database === 'ok' : online;

  return (
    <div>
      <PageHeader title="System" subtitle="Service status for AMS." />
      {error ? (
        <p className="mb-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="space-y-3 rounded-lg bg-white px-4 py-4 text-sm text-ink-700 shadow-ams">
        <p>
          <span className="font-semibold text-ink-900">AMS API</span>
          <span className="mt-0.5 block">{online ? 'Online' : error ? 'Unavailable' : 'Checking…'}</span>
        </p>
        <p>
          <span className="font-semibold text-ink-900">Database</span>
          <span className="mt-0.5 block">{databaseOk ? 'Connected' : error || health ? 'Unavailable' : 'Checking…'}</span>
        </p>
        <p>
          <span className="font-semibold text-ink-900">Version</span>
          <span className="mt-0.5 block">{AMS_VERSION}</span>
        </p>
        <p>
          <span className="font-semibold text-ink-900">Authentication</span>
          <span className="mt-0.5 block">Available</span>
        </p>
        {health?.timestamp ? (
          <p className="text-ink-500">Last check: {new Date(health.timestamp).toLocaleString()}</p>
        ) : null}
      </div>
    </div>
  );
}
