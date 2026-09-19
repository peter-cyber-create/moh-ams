export const AMS_VERSION = '2.8.0';

/** AMS-owned statuses. draft is unpublished. */
export const ACTIVITY_STATUSES = ['draft', 'planned', 'ongoing', 'report_submitted', 'closed', 'cancelled'];

export const ALLOWED_STATUS_TRANSITIONS = {
  draft: ['planned'],
  planned: ['ongoing', 'cancelled'],
  ongoing: ['report_submitted', 'cancelled'],
  report_submitted: ['closed', 'ongoing'],
  closed: [],
  cancelled: [],
};

/** Wave 3 / Wave 5 annual threshold. Exactly 150 is flagged. */
export const FLAG_DAY_THRESHOLD = 150;
export const MONTHLY_FIELD_DAY_LIMIT = 20;
export const ANNUAL_EARLY_WARNING_THRESHOLD = 120;

export const ALLOWED_REPORT_EXTENSIONS = ['.pdf', '.doc', '.docx'];
export const MAX_REPORT_BYTES = 5 * 1024 * 1024;

/** CURRENT LEGACY DUE: activities without a report file, not closed/cancelled. */
export const LEGACY_DUE_NOTE =
  'Current legacy due logic: no activity report file, and status is not closed or cancelled.';

export const DRAFT_KEY = 'ams_activity_draft';

export function roleProfile(user) {
  const moduleName = String(user?.module || '').toLowerCase();
  const roleName = String(user?.role?.name || user?.roleName || '').toLowerCase();
  const isAdmin =
    moduleName === 'admin' ||
    moduleName === 'all' ||
    moduleName === 'all modules' ||
    roleName.includes('admin') ||
    roleName.includes('super');
  const isReviewerRole = roleName.includes('review') || roleName.includes('auditor');
  const isReviewer = isAdmin || isReviewerRole;
  const isCompliance = isAdmin || isReviewer || roleName.includes('compliance');
  const isOfficer = isAdmin || ((moduleName === 'finance' || moduleName === '') && !isReviewerRole);
  return { isAdmin, isReviewer, isCompliance, isOfficer };
}

/**
 * Hierarchical sidebar navigation. Groups expand only when useful.
 * Children must be real working destinations (no dead links).
 */
export function sidebarNav(user) {
  const { isOfficer, isReviewer, isAdmin } = roleProfile(user);
  const items = [{ id: 'dashboard', to: '/', label: 'Dashboard', match: ['/'] }];

  if (isOfficer || isReviewer) {
    items.push({
      id: 'activities',
      label: 'Activities',
      match: ['/activities'],
      children: [
        { to: '/activities', label: 'All Activities', exact: true },
        { to: '/activities/register', label: 'New Activity' },
      ],
    });
  }

  const accChildren = [
    { to: '/accountability?view=all', label: 'All' },
    { to: '/accountability?view=due', label: 'Due' },
    { to: '/accountability?view=overdue', label: 'Overdue' },
  ];
  if (isReviewer) {
    accChildren.push({ to: '/accountability?view=review', label: 'Under Review' });
  }
  accChildren.push(
    { to: '/accountability?view=returned', label: 'Returned' },
    { to: '/accountability?view=clarification', label: 'Clarification' },
  );
  items.push({
    id: 'accountability',
    label: 'Accountability',
    match: ['/accountability'],
    children: accChildren,
  });

  if (isOfficer || isReviewer) {
    items.push({
      id: 'compliance',
      label: 'Compliance',
      match: ['/compliance', '/persons'],
      children: [
        { to: '/compliance?tab=overview', label: 'Overview' },
        { to: '/compliance?tab=participation', label: 'Participation' },
        { to: '/compliance?tab=monthly', label: 'Monthly' },
        { to: '/compliance?tab=accountabilities', label: 'Accountabilities' },
        { to: '/compliance?tab=overlaps', label: 'Overlaps' },
      ],
    });
  }

  items.push({
    id: 'reports',
    label: 'Reports',
    match: ['/reports'],
    children: [
      { to: '/reports?category=activities', label: 'Activities' },
      { to: '/reports?category=people', label: 'People' },
      { to: '/reports?category=financial', label: 'Financial' },
      { to: '/reports?category=compliance', label: 'Compliance' },
    ],
  });

  const moreChildren = [
    { to: '/profile', label: 'My Profile' },
    { to: '/activities/templates', label: 'Templates' },
    { to: '/help', label: 'Help' },
  ];
  if (isAdmin) {
    moreChildren.push(
      { divider: true },
      {
        id: 'administration',
        label: 'Administration',
        to: '/admin',
        exact: true,
        children: [
          { to: '/admin/users', label: 'Users' },
          { to: '/admin/access', label: 'Roles & Access' },
        ],
      },
      { to: '/system', label: 'System' },
    );
  }
  items.push({
    id: 'more',
    label: 'More',
    match: ['/more', '/activities/templates', '/help', '/admin', '/system', '/profile'],
    children: moreChildren,
  });

  return items;
}

/** Flat primary labels for tests / compatibility. */
export function primaryNav(user) {
  return sidebarNav(user).map((item) => ({
    to: item.to || (item.children && item.children[0]?.to) || '/',
    label: item.label,
    match: item.match,
    children: item.children,
  }));
}

/** Secondary tools under More — not primary sidebar items. */
export function moreNav(user) {
  const { isAdmin } = roleProfile(user);
  const items = [
    { to: '/profile', title: 'My Profile', body: 'View your account and change your password.' },
    { to: '/activities/templates', title: 'Templates', body: 'Download the Participant List Excel template.' },
    { to: '/help', title: 'Help', body: 'Short answers for everyday AMS work.' },
  ];
  if (isAdmin) {
    items.push({ to: '/admin', title: 'Administration', body: 'Users and roles.' });
    items.push({ to: '/system', title: 'System', body: 'Service health check.' });
  }
  return items;
}

function pathOnly(href) {
  return String(href || '').split('?')[0];
}

function queryOf(href) {
  const q = String(href || '').split('?')[1] || '';
  return new URLSearchParams(q);
}

/** Match a nav child link, including query params when present. */
export function isNavChildActive(child, pathname, search = '') {
  if (child.children?.length) {
    return (
      isNavChildActive({ ...child, children: undefined }, pathname, search) ||
      child.children.some((nested) => isNavChildActive(nested, pathname, search))
    );
  }
  const path = pathname || '/';
  const childPath = pathOnly(child.to);
  const childQuery = queryOf(child.to);
  const currentQuery = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if (child.exact) {
    if (path !== childPath) return false;
  } else if (childPath === '/') {
    if (path !== '/') return false;
  } else if (!(path === childPath || path.startsWith(`${childPath}/`))) {
    return false;
  }

  // Templates are under More, not Activities.
  if (childPath === '/activities' && path.startsWith('/activities/templates')) return false;

  for (const [key, value] of childQuery.entries()) {
    const current = currentQuery.get(key);
    if (current === value) continue;
    // Defaults: Accountability without ?view is "all"; Compliance without ?tab is "overview".
    if (key === 'view' && value === 'all' && !current && childPath === '/accountability') continue;
    if (key === 'tab' && value === 'overview' && !current && childPath === '/compliance') continue;
    return false;
  }
  return true;
}

/** Which primary nav item is active for the current path. */
export function isNavActive(item, pathname, search = '') {
  const path = pathname || '/';
  if (item.children?.length) {
    return item.children.some((c) => isNavChildActive(c, path, search)) || matchesParent(item, path);
  }
  if (item.to === '/' || (item.match && item.match[0] === '/')) return path === '/';
  return matchesParent(item, path);
}

function matchesParent(item, path) {
  const prefixes = item.match || (item.to ? [item.to] : []);
  return prefixes.some((p) => {
    if (p === '/') return path === '/';
    if (p === '/more') {
      return (
        path === '/more' ||
        path.startsWith('/activities/templates') ||
        path.startsWith('/help') ||
        path.startsWith('/admin') ||
        path.startsWith('/system') ||
        path.startsWith('/profile')
      );
    }
    if (p === '/activities') {
      if (path.startsWith('/activities/templates')) return false;
      return path === '/activities' || path.startsWith('/activities/');
    }
    if (p === '/compliance') {
      return path === '/compliance' || path.startsWith('/compliance/') || path.startsWith('/persons/');
    }
    return path === p || path.startsWith(`${p}/`);
  });
}

/** Id of the parent group that should auto-expand for the current location. */
export function activeNavGroupId(user, pathname, search = '') {
  const items = sidebarNav(user);
  const active = items.find((item) => isNavActive(item, pathname, search));
  return active?.id || null;
}

export function statusLabel(status) {
  const key = String(status || '').toLowerCase();
  const map = {
    draft: 'Draft',
    planned: 'Planned',
    ongoing: 'Ongoing',
    report_submitted: 'Report submitted',
    submitted: 'Submitted',
    under_review: 'Under review',
    clarification_requested: 'Clarification requested',
    returned: 'Returned',
    resubmitted: 'Resubmitted',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
    cancelled: 'Cancelled',
    multiple_issues: 'Multiple issues',
    clear: 'Clear',
    near_limit: 'Near limit',
    threshold_reached: 'Threshold reached',
    participation_exceeded: 'Participation exceeded',
    accountability_pending: 'Accountability pending',
    accountability_overdue: 'Accountability overdue',
    action_required: 'Action required',
    non_compliant: 'Non-compliant',
  };
  return map[key] || status || 'Planned';
}

export function statusTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'closed' || key === 'approved' || key === 'clear') return 'ok';
  if (key === 'cancelled' || key === 'rejected') return 'neutral';
  if (key === 'report_submitted' || key === 'submitted' || key === 'under_review' || key === 'resubmitted' || key === 'near_limit') return 'info';
  if (
    key === 'planned' ||
    key === 'ongoing' ||
    key === 'draft' ||
    key === 'returned' ||
    key === 'clarification_requested' ||
    key === 'threshold_reached' ||
    key === 'participation_exceeded' ||
    key === 'accountability_pending' ||
    key === 'accountability_overdue' ||
    key === 'multiple_issues' ||
    key === 'non_compliant' ||
    key === 'action_required'
  ) {
    return 'warn';
  }
  return 'neutral';
}

export function canEditActivity(activity) {
  const status = String(activity?.status || 'planned').toLowerCase();
  return status === 'draft' || status === 'planned' || status === 'ongoing';
}

export function canTransition(from, to) {
  const current = String(from || 'planned').trim().toLowerCase();
  const next = String(to || '').trim().toLowerCase();
  if (!(next in ALLOWED_STATUS_TRANSITIONS)) return false;
  if (current === next) return true;
  return ALLOWED_STATUS_TRANSITIONS[current]?.includes(next) === true;
}

export function allowedNextStatuses(from) {
  const current = String(from || 'planned').trim().toLowerCase();
  return ALLOWED_STATUS_TRANSITIONS[current] || [];
}

export function validateReportFile(file) {
  if (!file) return 'Attach the supporting document first.';
  const name = String(file.name || '');
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  if (!ALLOWED_REPORT_EXTENSIONS.includes(ext)) {
    return 'Invalid file type. Allowed: pdf, doc, docx.';
  }
  if (typeof file.size === 'number' && file.size > MAX_REPORT_BYTES) {
    return 'File is too large. Maximum size is 5MB.';
  }
  return '';
}

export function formatMoney(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function daysSince(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** CURRENT LEGACY DUE LOGIC — no activity report document, not closed/cancelled/draft. */
export function needsActivityReport(activity) {
  const status = String(activity?.status || '').toLowerCase();
  if (status === 'closed' || status === 'cancelled' || status === 'draft') return false;
  if (typeof activity?.hasActivityReport === 'boolean') return !activity.hasActivityReport;
  const path = activity?.reportPath;
  return path == null || String(path).trim() === '';
}

/** @deprecated alias kept so existing imports stay valid during Wave 0 */
export function needsAccountability(activity) {
  return needsActivityReport(activity);
}

export function isOverdue(activity, days = 60) {
  if (!needsActivityReport(activity)) return false;
  const elapsed = daysSince(activity.invoiceDate || activity.createdAt);
  return elapsed != null && elapsed >= days;
}

export function activityTitle(activity) {
  return activity?.title || activity?.activityName || 'Untitled activity';
}

export function activityRef(activity) {
  return activity?.voucherNumber || activity?.vocherno || activity?.id?.slice(0, 8) || '—';
}

export function unwrapList(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function sanitizeParticipants(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error('Participants must be a list.');
  return input.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Participant ${index + 1} is invalid.`);
    const name = String(row.name ?? '').trim();
    if (!name) throw new Error(`Participant ${index + 1} needs a name.`);
    return {
      name,
      title: row.title != null ? String(row.title) : '',
      phone: row.phone != null ? String(row.phone) : '',
      amount: Number(row.amount) || 0,
      days: Number(row.days) || 0,
    };
  });
}

export function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

export function saveLocalDraft(form) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
}

export function clearLocalDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
