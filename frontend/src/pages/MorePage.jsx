import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { moreNav } from '../lib/ams';
import { useAuth } from '../lib/AuthContext';

export default function MorePage() {
  const { user } = useAuth();
  const items = moreNav(user);

  return (
    <div>
      <PageHeader title="More" subtitle="Secondary tools and account settings." />
      <ul className="divide-y divide-ink-100 rounded-lg bg-white shadow-ams">
        {items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="block px-4 py-3 hover:bg-paper">
              <span className="font-semibold text-ink-900">{item.title}</span>
              <span className="mt-0.5 block text-sm text-ink-500">{item.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
