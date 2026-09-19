export default function EmptyState({ title, body, action }) {
  return (
    <div className="ams-card text-center">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
