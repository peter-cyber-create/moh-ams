export default function NextAction({ title, body, children }) {
  return (
    <section className="rounded-2xl border border-teal-100 bg-teal-100/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Next action</p>
      <h2 className="mt-1 font-display text-xl text-ink-900">{title}</h2>
      {body ? <p className="mt-1 text-sm text-ink-700">{body}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
    </section>
  );
}
