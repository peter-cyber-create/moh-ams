import { Link } from 'react-router-dom';

export default function WorkCard({ to, label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'bg-white',
    alert: 'bg-rose-100',
    action: 'bg-gold-100',
  };
  return (
    <Link to={to} className={`ams-card block hover:ring-1 hover:ring-teal-800 ${tones[tone] || tones.default}`}>
      <p className="text-sm font-medium text-ink-500">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink-900">{value}</p>
      {hint ? <p className="mt-2 text-sm text-teal-800">{hint}</p> : null}
    </Link>
  );
}
