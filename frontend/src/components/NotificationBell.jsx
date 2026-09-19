import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../lib/api';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const refresh = useCallback(() => {
    return api
      .get('/api/v1/notifications', { params: { limit: 15 } })
      .then((res) => {
        setUnreadCount(Number(res.data?.unreadCount || 0));
        setItems(res.data?.data || []);
        setError('');
      })
      .catch((err) => setError(errorMessage(err, 'Could not load notifications.')));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function openPanel() {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await refresh().finally(() => setLoading(false));
    }
  }

  async function openItem(n) {
    if (!n.isRead) {
      try {
        await api.post(`/api/v1/notifications/${n.id}/read`);
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      } catch {
        /* navigation still proceeds */
      }
    }
    setOpen(false);
    if (n.href) navigate(n.href);
  }

  async function markAllRead() {
    try {
      await api.post('/api/v1/notifications/read-all');
      setUnreadCount(0);
      setItems((list) => list.map((x) => ({ ...x, isRead: true })));
    } catch (err) {
      setError(errorMessage(err, 'Could not mark notifications as read.'));
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-800 hover:bg-paper"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        onClick={openPanel}
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-ink-100 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">
              {unreadCount ? `${unreadCount} new notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
            </p>
            {unreadCount > 0 ? (
              <button type="button" className="text-xs font-semibold text-teal-800" onClick={markAllRead}>
                Mark all as read
              </button>
            ) : null}
          </div>

          {error ? <p className="px-3 py-2 text-xs text-rose-700">{error}</p> : null}
          {loading ? <p className="px-3 py-4 text-sm text-ink-500">Loading notifications…</p> : null}

          {!loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">You&apos;re all caught up.</p>
          ) : null}

          {!loading && items.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={n.isRead ? 'bg-white' : 'bg-paper/80'}>
                  <button
                    type="button"
                    className="w-full border-b border-ink-50 px-3 py-3 text-left hover:bg-paper"
                    onClick={() => openItem(n)}
                  >
                    <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-600">{n.message}</span>
                    {n.href ? <span className="mt-1 block text-xs font-semibold text-teal-800">Open</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
