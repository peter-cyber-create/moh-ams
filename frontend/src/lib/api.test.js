import { describe, expect, it } from 'vitest';
import { errorMessage } from './api.js';
import { parseLoginResponse } from './auth.js';

describe('authentication error handling', () => {
  it('explains when the Finance API is unreachable', () => {
    expect(errorMessage({ code: 'ERR_NETWORK', message: 'Network Error' })).toMatch(/3020/);
  });

  it('explains invalid credentials', () => {
    expect(errorMessage({ response: { status: 401, data: { error: 'Invalid credentials' } } })).toBe(
      'Invalid credentials',
    );
  });

  it('explains unauthorized module access', () => {
    expect(errorMessage({ response: { status: 403, data: {} } })).toMatch(/access/);
  });

  it('rejects a malformed login response', () => {
    expect(() => parseLoginResponse({})).toThrow(/incomplete/);
    expect(parseLoginResponse({ token: 'abc', user: { id: '1' } })).toEqual({
      token: 'abc',
      user: { id: '1' },
    });
  });
});
