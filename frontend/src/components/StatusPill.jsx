import { statusLabel, statusTone } from '../lib/ams';

const TONE = {
  ok: 'bg-teal-100 text-teal-900',
  info: 'bg-gold-100 text-ink-900',
  warn: 'bg-rose-100 text-rose-700',
  neutral: 'bg-ink-100 text-ink-700',
};

export default function StatusPill({ status }) {
  const tone = statusTone(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone] || TONE.neutral}`}>
      {statusLabel(status)}
    </span>
  );
}
