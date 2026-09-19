export const ADMIN_API = '/api/v1/admin';

export const ACCESS_ROLE_HINTS = {
  Officer: 'Can manage your own operational work.',
  Reviewer: 'Can review assigned or permitted cases.',
  Administrator: 'Can manage users and system administration.',
};

export function validatePasswordPair(password, confirm) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password !== confirm) return 'Password and confirmation do not match.';
  return '';
}
