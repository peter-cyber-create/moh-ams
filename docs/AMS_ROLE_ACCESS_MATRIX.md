# AMS Role Access Matrix

Source of truth: AMS domain permission helpers + this matrix for administrators.

| Function | Officer | Reviewer | Administrator |
|---|---|---|---|
| Own Activities | Yes | Yes | Yes |
| Create Activity | Yes | Yes | Yes |
| Multiple Activities | Yes | Yes | Yes |
| Participant Upload | Yes | Yes | Yes |
| Own Accountability | Yes | Yes | Yes |
| Review Accountability | No | Yes | Yes |
| Compliance | Limited | Yes | Yes |
| Reports | Yes | Yes | Yes |
| User Management | No | No | Yes |
| Administration | No | No | Yes |
| System | No | No | Yes |

## Role descriptions

- **Officer** — Create/manage own Activities and perform permitted operational work.
- **Reviewer** — Review Activities/Accountabilities and permitted compliance functions.
- **Administrator** — Manage AMS users and authorized administrative functions.

## API enforcement

UI hiding is usability only. Protected endpoints return **401** (unauthenticated) or **403** (authenticated, not allowed).
