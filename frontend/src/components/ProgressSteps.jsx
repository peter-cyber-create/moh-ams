export default function ProgressSteps({ steps, current }) {
  const cols =
    steps.length <= 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : steps.length <= 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

  return (
    <ol className={`mb-8 grid gap-2 ${cols}`}>
      {steps.map((step, index) => {
        const n = index + 1;
        const active = n === current;
        const done = n < current;
        return (
          <li
            key={step}
            className={`rounded-xl px-3 py-2 text-sm ${
              active ? 'bg-teal-800 text-white' : done ? 'bg-teal-100 text-teal-900' : 'bg-white text-ink-500'
            }`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-wide">
              {String(n).padStart(2, '0')}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}
