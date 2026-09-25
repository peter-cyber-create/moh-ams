import axios from 'axios';
import { clearSession, getToken } from './auth';

const api = axios.create({ headers: { 'Content-Type': 'application/json' } });

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
      return 'The AMS or sign-in service is unavailable. Confirm AMS API port 3020 and Finance login port 3000.';
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

export default api;
