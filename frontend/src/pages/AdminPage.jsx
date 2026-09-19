import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { roleProfile } from '../lib/ams';
import { useAuth } from '../lib/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();
  const { isAdmin } = roleProfile(user);
  if (!isAdmin) {
    return <EmptyState title="Administration is limited to administrators." action={<Link to="/">Home</Link>} />;
  }
  return (
    <div>
      <PageHeader title="Administration" subtitle="Manage AMS accounts and review how access is assigned." />
      <ul className="divide-y divide-ink-100 rounded-lg bg-white shadow-ams">
        <li>
          <Link to="/admin/users" className="block px-4 py-4 hover:bg-paper">
            <span className="font-semibold text-ink-900">Users</span>
            <span className="mt-0.5 block text-sm text-ink-500">Manage AMS user accounts and roles.</span>
            <span className="mt-2 inline-block text-sm font-semibold text-teal-800">Open Users</span>
          </Link>
        </li>
        <li>
          <Link to="/admin/access" className="block px-4 py-4 hover:bg-paper">
            <span className="font-semibold text-ink-900">Roles &amp; Access</span>
            <span className="mt-0.5 block text-sm text-ink-500">View how system access is assigned.</span>
            <span className="mt-2 inline-block text-sm font-semibold text-teal-800">View Access</span>
          </Link>
        </li>
      </ul>
      <Link to="/system" className="mt-4 inline-block text-sm font-semibold text-teal-800">
        Open System status
      </Link>
    </div>
  );
}
