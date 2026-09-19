import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from './api';
import { clearSession, getToken, getUser, parseLoginResponse, setSession } from './auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [token, setToken] = useState(() => getToken());

  // Refresh profile from identity service so role/status stay authoritative.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api
      .get('/api/auth/me')
      .then((res) => {
        if (cancelled) return;
        const nextUser = res.data;
        setSession(token, nextUser);
        setUser(nextUser);
      })
      .catch(() => {
        /* 401 interceptor handles expired sessions */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      async login(loginId, password) {
        const res = await api.post('/api/auth/login', { email: loginId, password });
        const { token: nextToken, user: nextUser } = parseLoginResponse(res.data);
        setSession(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
        return nextUser;
      },
      async refreshProfile() {
        const res = await api.get('/api/auth/me');
        setSession(token, res.data);
        setUser(res.data);
        return res.data;
      },
      logout() {
        clearSession();
        setToken(null);
        setUser(null);
      },
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function RequireAuth({ children }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
