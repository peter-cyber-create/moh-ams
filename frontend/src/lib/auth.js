const TOKEN_KEY = 'ams_token';
const USER_KEY = 'ams_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function parseLoginResponse(data) {
  const token = data?.token;
  const user = data?.user ?? null;
  if (!token || typeof token !== 'string') {
    throw new Error('Sign in returned an incomplete response.');
  }
  return { token, user };
}
