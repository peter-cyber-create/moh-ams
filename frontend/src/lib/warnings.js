/** Turn technical flags into plain Ministry language for officers. */
export function humanizeWarning(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  let msg = raw
    .replace(/\bEARLY_WARNING\b/gi, 'approaching the annual field-day limit')
    .replace(/\bTHRESHOLD_REACHED\b/gi, 'reached the 150-day annual field-day limit')
    .replace(/\bEXCEEDED\b/gi, 'exceeded the annual field-day limit')
    .replace(/\bMONTHLY_LIMIT_EXCEEDED\b/gi, 'exceeded the 20-day monthly field-day limit')
    .replace(/\bMONTHLY_LIMIT_REACHED\b/gi, 'reached the 20-day monthly field-day limit')
    .replace(/\bOVERLAP_DETECTED\b/gi, 'is already assigned to another activity during these dates')
    .replace(/\bPOTENTIAL_PARTICIPANT_OVERLAP\b/gi, 'may match another participant on overlapping dates')
    .replace(/\bPOTENTIAL_IDENTITY_MATCH\b/gi, 'may be the same person as another participant')
    .replace(/_/g, ' ');
  return msg;
}

export function warningLevel(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('exceed') || t.includes('overdue') || t.includes('>150') || t.includes('over 150')) return 'action';
  if (
    t.includes('warn') ||
    t.includes('approaching') ||
    t.includes('120') ||
    t.includes('overlap') ||
    t.includes('pending') ||
    t.includes('150') ||
    t.includes('monthly') ||
    t.includes('review')
  ) {
    return 'warning';
  }
  return 'normal';
}

export function humanResultLabel(result) {
  const r = String(result || '').toUpperCase().replace(/ /g, '_');
  if (r === 'CLEAR' || r === 'OK') return 'No issue';
  if (r.includes('EARLY')) return 'Approaching annual limit';
  if (r.includes('THRESHOLD')) return 'At 150 days';
  if (r.includes('EXCEED')) return 'Over 150 days';
  if (r.includes('MONTHLY')) return 'Monthly limit issue';
  if (r.includes('OVERLAP')) return 'Possible overlap';
  if (r.includes('ACTION')) return 'Needs review';
  if (r.includes('PENDING')) return 'Pending accountability';
  if (r.includes('OVERDUE')) return 'Overdue accountability';
  return String(result || '').replace(/_/g, ' ');
}
