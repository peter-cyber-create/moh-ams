import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import {
  AMS_VERSION,
  activeNavGroupId,
  isNavActive,
  isNavChildActive,
  sidebarNav,
} from '../lib/ams';
import { useAuth } from '../lib/AuthContext';

function NavChildLink({ child, pathname, search }) {
  const childActive = isNavChildActive(child, pathname, search);
  return (
    <Link
      to={child.to}
      aria-current={childActive ? 'page' : undefined}
      className={`block rounded-md px-2 py-1 text-sm ${
        childActive
          ? 'bg-teal-800 font-semibold text-white'
          : 'font-medium text-ink-600 hover:bg-paper hover:text-ink-900'
      }`}
    >
      {child.label}
    </Link>
  );
}

function NavGroup({ item, pathname, search, expanded, onToggle, collapsed }) {
  const parentActive = isNavActive(item, pathname, search);
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  if (!hasChildren) {
    const active = isNavActive(item, pathname, search);
    return (
      <Link
        to={item.to || '/'}
        aria-current={active ? 'page' : undefined}
        title={item.label}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
          active ? 'bg-teal-800 text-white shadow-sm' : 'text-ink-700 hover:bg-paper'
        } ${collapsed ? 'justify-center px-2' : ''}`}
      >
        {collapsed ? (
          <span aria-hidden className="text-xs font-bold uppercase">
            {item.label.slice(0, 1)}
          </span>
        ) : (
          <span>{item.label}</span>
        )}
      </Link>
    );
  }

  if (collapsed) {
    const landing = item.children.find((c) => c.exact && c.to) || item.children.find((c) => c.to) || item.children[0];
    return (
      <Link
        to={landing?.to || '/'}
        title={item.label}
        aria-current={parentActive ? 'page' : undefined}
        className={`flex items-center justify-center rounded-lg px-2 py-2 text-sm font-semibold ${
          parentActive ? 'bg-teal-800 text-white shadow-sm' : 'text-ink-700 hover:bg-paper'
        }`}
      >
        <span aria-hidden className="text-xs font-bold uppercase">
          {item.label.slice(0, 1)}
        </span>
        <span className="sr-only">{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ${
          parentActive ? 'bg-teal-800/10 text-teal-900' : 'text-ink-700 hover:bg-paper'
        }`}
        aria-expanded={expanded}
        onClick={() => onToggle(item.id)}
      >
        <span>{item.label}</span>
        <span aria-hidden className="text-xs text-ink-500">
          {expanded ? '▴' : '▾'}
        </span>
      </button>
      {expanded ? (
        <ul className="mb-0.5 ml-2 space-y-0.5 border-l border-ink-100 pl-2">
          {item.children.map((child) => {
            if (child.divider) {
              return (
                <li key="divider" aria-hidden className="my-1 border-t border-ink-100" />
              );
            }
            if (child.children?.length) {
              const groupActive =
                isNavChildActive(child, pathname, search) ||
                child.children.some((nested) => isNavChildActive(nested, pathname, search));
              return (
                <li key={child.id || child.label}>
                  <Link
                    to={child.to || child.children[0]?.to || '/'}
                    aria-current={groupActive ? 'page' : undefined}
                    className={`block rounded-md px-2 py-1 text-sm font-semibold ${
                      groupActive ? 'text-teal-900' : 'text-ink-700 hover:text-ink-900'
                    }`}
                  >
                    {child.label}
                  </Link>
                  <ul className="ml-2 space-y-0.5 border-l border-ink-100 pl-2">
                    {child.children.map((nested) => (
                      <li key={`${nested.to}-${nested.label}`}>
                        <NavChildLink child={nested} pathname={pathname} search={search} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }
            return (
              <li key={`${child.to}-${child.label}`}>
                <NavChildLink child={child} pathname={pathname} search={search} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function AmsShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const items = useMemo(() => sidebarNav(user), [user]);
  const currentGroup = activeNavGroupId(user, location.pathname, location.search);
  const [expandedIds, setExpandedIds] = useState(() => (currentGroup ? new Set([currentGroup]) : new Set()));

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!currentGroup) return;
    setExpandedIds((prev) => {
      if (prev.has(currentGroup)) return prev;
      const next = new Set(prev);
      next.add(currentGroup);
      return next;
    });
  }, [currentGroup]);

  function toggleGroup(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function signOut() {
    logout();
    navigate('/login');
  }

  const asideWidth = collapsed ? 'w-[4.5rem]' : 'w-60';
  const mainOffset = collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-60';

  return (
    <div className="min-h-screen">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink-900/40 no-print lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r border-ink-200 bg-white transition-transform ${asideWidth} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Main navigation"
      >
        <div className={`shrink-0 border-b border-ink-100 px-3 py-3 ${collapsed ? 'px-2' : ''}`}>
          <Link to="/" className="flex items-start gap-2">
            <img
              src="/branding/uganda-coat-of-arms.png"
              alt=""
              className="mt-0.5 h-8 w-8 shrink-0 object-contain"
            />
            {!collapsed ? (
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Ministry of Health
                </span>
                <span className="block font-display text-base leading-tight text-ink-900">AMS</span>
                <span className="block text-xs text-ink-500">Activities Management</span>
              </span>
            ) : (
              <span className="sr-only">Activities Management System</span>
            )}
          </Link>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-2 py-2">
          {items.map((item) => (
            <NavGroup
              key={item.id || item.label}
              item={item}
              pathname={location.pathname}
              search={location.search}
              expanded={expandedIds.has(item.id)}
              onToggle={toggleGroup}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-ink-100 p-2">
          <button
            type="button"
            className="hidden w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-ink-500 hover:bg-paper lg:block"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : 'Collapse sidebar'}
          </button>
          <p className={`px-2 pb-1 text-[10px] text-ink-500 ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? `v${AMS_VERSION}` : `AMS v${AMS_VERSION}`}
          </p>
        </div>
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-col ${mainOffset}`}>
        <header className="no-print sticky top-0 z-20 border-b border-ink-100 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="ams-btn-secondary lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
            >
              Menu
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">Activities Management System</p>
              <p className="truncate text-xs text-ink-500">Republic of Uganda · Ministry of Health</p>
            </div>
            <NotificationBell />
            <Link
              to="/profile"
              className="hidden max-w-[12rem] truncate text-right text-sm text-ink-700 hover:text-teal-800 sm:block"
              title="My Profile"
            >
              {user?.name || user?.email}
            </Link>
            <button type="button" className="ams-btn-ghost px-3 py-1.5 text-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
