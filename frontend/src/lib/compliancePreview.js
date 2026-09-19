import { useEffect, useState } from 'react';
import { COMPLIANCE_API } from './compliance';
import api, { errorMessage } from './api';

export function inclusiveDaysFromDates(startIso, endIso) {
  if (!startIso) return null;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000) + 1;
  return diff < 1 ? null : diff;
}

export async function fetchCompliancePreview({ title, activityDate, endDate, participants, excludeActivityId }) {
  const res = await api.post(`${COMPLIANCE_API}/preview`, {
    title,
    activityDate: activityDate || null,
    endDate: endDate || null,
    excludeActivityId: excludeActivityId || null,
    participants: (participants || []).map((p) => ({
      name: p.name,
      phone: p.phone || null,
      title: p.title || null,
      personId: p.personId || null,
    })),
  });
  return res.data;
}

export function previewErrorMessage(err) {
  return errorMessage(err, 'Could not run compliance preview.');
}

/** Lightweight preview panel used on register/edit flows. */
export function useCompliancePreview({ title, activityDate, endDate, participants, excludeActivityId, enabled }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !activityDate) {
      setPreview(null);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchCompliancePreview({ title, activityDate, endDate, participants, excludeActivityId })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null);
          setError(previewErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [title, activityDate, endDate, JSON.stringify(participants), excludeActivityId, enabled]);

  return { preview, error, loading };
}
