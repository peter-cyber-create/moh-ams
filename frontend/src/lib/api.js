import axios from 'axios';
import { clearSession, getToken } from './auth';

export const apiOrigin = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiOrigin}${normalized}`;
}

const api = axios.create({
  baseURL: apiOrigin || undefined,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const path =
      typeof window === 'undefined'
        ? ''
        : base && window.location.pathname.startsWith(base)
          ? window.location.pathname.slice(base.length) || '/'
          : window.location.pathname;
    const onLogin = path === '/login' || path.startsWith('/login/');
    if (err.response?.status === 401 && typeof window !== 'undefined' && !onLogin) {
      clearSession();
      window.location.replace(`${import.meta.env.BASE_URL}login?session=expired`);
    }
    return Promise.reject(err);
  },
);

export function errorMessage(err, fallback = 'Something went wrong.') {
  if (!err?.response) {
    const msg = String(err?.message || '');
    if (err?.code === 'ERR_NETWORK' || msg === 'Network Error' || msg.includes('ECONNREFUSED')) {
      return 'The service is unavailable. Try again shortly, or contact your system administrator if it continues.';
    }
    return msg || fallback;
  }
  if (err.response.status === 401) {
    return err.response.data?.error || 'Invalid credentials or your session has expired.';
  }
  if (err.response.status === 403) {
    return err.response.data?.error || 'You do not have access to this action.';
  }
  return err.response.data?.error || fallback;
}

export async function openAuthenticatedFile(filePath) {
  const res = await api.get(filePath, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const a = document.createElement('a');
    a.href = url;
    a.download = String(filePath).split('/').pop() || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default api;
