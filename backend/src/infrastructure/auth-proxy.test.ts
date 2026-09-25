import assert from 'node:assert/strict';
import test from 'node:test';
import { isProxiedAuthRoute, loginAttemptBlocked, resetLoginAttempts } from '../presentation/auth-proxy.js';

test('only sign-in, profile, and password change are proxied', () => {
  assert.equal(isProxiedAuthRoute('POST', '/api/auth/login'), true);
  assert.equal(isProxiedAuthRoute('GET', '/api/auth/me'), true);
  assert.equal(isProxiedAuthRoute('POST', '/api/auth/change-password'), true);
  assert.equal(isProxiedAuthRoute('POST', '/api/auth/register'), false);
  assert.equal(isProxiedAuthRoute('GET', '/api/admin/users'), false);
});

test('sign-in attempts are limited per address', () => {
  resetLoginAttempts();
  const ip = '203.0.113.10';
  for (let i = 0; i < 10; i += 1) assert.equal(loginAttemptBlocked(ip, 1_000), false);
  assert.equal(loginAttemptBlocked(ip, 1_000), true);
  resetLoginAttempts();
});
