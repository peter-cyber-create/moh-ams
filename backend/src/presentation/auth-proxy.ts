import type { Request, Response } from 'express';
import { config } from '../config.js';

const ALLOWED = new Set(['POST /api/auth/login', 'GET /api/auth/me', 'POST /api/auth/change-password']);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; reset: number }>();

export function isProxiedAuthRoute(method: string, urlPath: string) {
  const path = urlPath.split('?')[0];
  return ALLOWED.has(`${method.toUpperCase()} ${path}`);
}

export function loginAttemptBlocked(ip: string, now = Date.now()) {
  for (const [key, row] of attempts) {
    if (row.reset < now) attempts.delete(key);
  }
  const row = attempts.get(ip);
  if (!row || row.reset < now) {
    attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > MAX_ATTEMPTS;
}

export function resetLoginAttempts() {
  attempts.clear();
}

/** Browser sign-in stays on the AMS origin. Only the three identity routes are forwarded. */
export async function proxyAuth(req: Request, res: Response) {
  const urlPath = `${req.baseUrl}${req.path}`;
  if (!isProxiedAuthRoute(req.method, urlPath)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (req.method === 'POST' && req.path === '/login') {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (loginAttemptBlocked(ip)) {
      res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' });
      return;
    }
  }
  if (!config.financeApiUrl) {
    res.status(503).json({ error: 'The sign-in service is unavailable.' });
    return;
  }
  try {
    const headers = new Headers();
    if (req.headers.authorization) headers.set('Authorization', req.headers.authorization);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    if (hasBody) headers.set('Content-Type', 'application/json');
    const upstream = await fetch(new URL(req.originalUrl, config.financeApiUrl), {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    });
    const text = await upstream.text();
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('Content-Type', type);
    res.status(upstream.status).send(text);
  } catch {
    res.status(503).json({ error: 'The sign-in service is unavailable.' });
  }
}
