# AMS Wave 6 — Identity & Access

**Version:** 2.7.0

## Current authentication

- Login: Finance `POST /api/auth/login` (email/username + password).
- Passwords: bcrypt in Finance only (`User.passwordHash`). AMS never stores passwords.
- JWT issued by Finance; AMS verifies with shared `JWT_SECRET`.
- AMS frontend stores `ams_token` / `ams_user` in localStorage.
- Self-service password change: Finance `POST /api/auth/change-password` (current + new).

## Current authorization

- AMS builds `Actor` from Finance `/api/auth/me` on **every** authenticated request (Wave 6 refresh).
- Permissions derived from `module` + `roleName` (Officer / Reviewer / Administrator heuristics).
- ICT → empty permission sets → **403** on protected AMS APIs.
- Admin user APIs: AMS `hasAdminPermission` + Finance `requireModule('Admin')`.

## User / role model

| Concept | Location |
|---|---|
| Login credentials | Finance `User` |
| AMS snapshot | AMS `IdentityUser` |
| Business identity | AMS `Person` (optional link) |
| AMS roles | Officer, Reviewer, Administrator (mapped to Finance module + Role) |

## Gaps closed in Wave 6

- Administration → Users CRUD UI
- Role assignment with confirmation
- Deactivate / reactivate (+ last-admin protection)
- Admin password reset (set only, never view)
- Password visibility component
- Access matrix view
- Admin audit events (`admin_audit_event`)

## Known limitations

- No email/SMS, SSO, LDAP, or enterprise IAM.
- Last login is not stored by Finance User (not shown).
- Soft-delete preferred; hard delete not exposed in AMS UI.
- Finance auth module gained `change-password` and clearer inactive-login messaging; Inventory modules were not modified.
