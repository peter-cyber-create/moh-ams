import { describe, expect, it } from 'vitest';
import { validatePasswordPair, ACCESS_ROLE_HINTS } from './admin.js';

describe('admin helpers', () => {
  it('validates password pairs', () => {
    expect(validatePasswordPair('', '')).toMatch(/required/i);
    expect(validatePasswordPair('short', 'short')).toMatch(/8/);
    expect(validatePasswordPair('Password1', 'Password2')).toMatch(/match/i);
    expect(validatePasswordPair('Password1', 'Password1')).toBe('');
  });

  it('has role hints for AMS roles', () => {
    expect(ACCESS_ROLE_HINTS.Officer).toBeTruthy();
    expect(ACCESS_ROLE_HINTS.Reviewer).toBeTruthy();
    expect(ACCESS_ROLE_HINTS.Administrator).toBeTruthy();
  });
});
