import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { roleProfile } from '../lib/ams';
import { useAuth } from '../lib/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const { isAdmin, isReviewer, isOfficer } = roleProfile(user);
  const roleLabel = isAdmin ? 'Administrator' : isReviewer ? 'Reviewer' : isOfficer ? 'Officer' : 'Limited';

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your AMS sign-in details." />
      <div className="space-y-3 rounded-lg bg-white px-4 py-4 text-sm text-ink-700 shadow-ams">
        <p>
          <span className="font-semibold text-ink-900">Name:</span> {user?.name || '—'}
        </p>
        <p>
          <span className="font-semibold text-ink-900">Email:</span> {user?.email || '—'}
        </p>
        <p>
          <span className="font-semibold text-ink-900">Role:</span> {roleLabel}
          {user?.role?.name ? ` (${user.role.name})` : ''}
        </p>
        <p>
          <span className="font-semibold text-ink-900">Department:</span>{' '}
          {user?.department?.name || '—'}
        </p>
        <p>
          <span className="font-semibold text-ink-900">Status:</span>{' '}
          {user?.isActive === false ? 'Inactive' : 'Active'}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/profile/password" className="ams-btn-primary">
          Change password
        </Link>
        <Link to="/" className="ams-btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
