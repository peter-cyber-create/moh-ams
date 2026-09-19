# AMS Password Security

## Storage

- Passwords are hashed with **bcrypt** (cost 10) in the Finance identity service.
- AMS does not store passwords or hashes.
- API responses never include `passwordHash`.
- Passwords are not written to admin audit events.

## Validation

- Minimum length: 8 characters.
- Create / reset / change: password and confirmation must match.

## Visibility (frontend only)

Reusable `PasswordInput` component:

- Hidden by default.
- Accessible Show / Hide button (`aria-label` toggles).
- Used on Login, Create User, Confirm Password, Change Password, Admin Reset.

Showing a password does not change its value.

## Change password

`POST /api/auth/change-password` with Bearer token:

- Verifies current password.
- Hashes and stores the new password in Finance.

## Admin reset

Administrator sets a new password via AMS → Finance `PATCH /api/admin/users/:id` with `password`. Never views the old password.
