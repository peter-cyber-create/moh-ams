# AMS Wave 0 baseline

Recorded from the running code on 14 August 2026. Nothing here is a target architecture.

Status key: **CURRENT** = implemented and in use. **PARTIAL** = exists but limited. **DEPENDENCY** = provided by another system. **NOT IMPLEMENTED**. **FUTURE** = later waves.

---

## Frontend (CURRENT)

Application: Vite + React 18 + Tailwind, port **3010**.

Location: `/home/peter/Projects/MOH/activities-tracker/frontend`

There is no AMS backend in this repository (`backend/` is empty).

### Routes

| Path | Page | Notes |
| --- | --- | --- |
| `/login` | LoginPage | CURRENT |
| `/forgot-password` | ForgotPasswordPage | CURRENT — tells the user to contact an administrator. No reset API. |
| `/` | HomePage | CURRENT |
| `/activities` | ActivitiesListPage | CURRENT |
| `/activities/register` | RegisterActivityPage | CURRENT — six-step wizard |
| `/activities/templates` | TemplatesPage | NOT IMPLEMENTED — labelled unavailable |
| `/activities/:id` | ActivityDetailPage | CURRENT |
| `/activities/:id/edit` | EditActivityPage | CURRENT — planned/ongoing only, PATCH |
| `/accountability` | AccountabilityListPage | PARTIAL — activity-report queue, not an Accountability entity |
| `/accountability/:id` | AccountabilityCasePage | PARTIAL — submit/close activity report |
| `/reports` | ReportsHubPage | CURRENT |
| `/reports/:reportId` | ReportViewPage | CURRENT |
| `/compliance` | CompliancePage | PARTIAL — live 150-day calculation |
| `/more` | MorePage | CURRENT |
| `/admin` | AdminPage | NOT IMPLEMENTED — labelled unavailable |
| `/system` | SystemPage | PARTIAL — GET `/health` only |
| `/help` | HelpPage | CURRENT |

### Components

AmsShell, EmptyState, NextAction, PageHeader, ProgressSteps, StatusPill, WorkCard.

### API calls used by AMS

- `POST /api/auth/login`
- `GET /api/finance/activities`
- `POST /api/finance/activities`
- `GET /api/finance/activities/:id`
- `PATCH /api/finance/activities/:id`
- `GET /api/finance/activities/:id/timeline`
- `POST /api/finance/activities/:id/report`
- `POST /api/finance/activities/participants/import`
- `GET /api/finance/reports/activities`
- `GET /api/finance/reports/person`
- `GET /api/finance/reports/funding`
- `GET /api/finance/reports/user/amounts`
- `GET /api/finance/reports/accountability`
- `GET /api/finance/reports/flagged`
- `GET /api/finance/reports/participant/activity`
- `GET /health`

Vite proxy: `/api`, `/health`, `/uploads` → `http://localhost:3000`.

### Auth and role logic (PARTIAL)

Login stores JWT in `ams_token` and user JSON in `ams_user`. `RequireAuth` checks for a token only.

`roleProfile()` / `primaryNav()` run in the browser from `user.module` and `user.role.name`. JWT `permissions` is an empty array. Restricted pages also check the same profile and show an empty state. API authorization is the Finance module gate on the Finance API.

### Navigation (CURRENT)

Home, Activities (officers), Accountability, Compliance (admin/reviewer/compliance), Reports, More.

Identity: Ministry of Health / Activities Management System. Coat of Arms from `frontend/public/branding/uganda-coat-of-arms.png`.

### Forms and activity screens (CURRENT)

Register wizard steps: Activity details → Dates & location → Funding → Participants → Documents → Review & submit.

Drafts: `localStorage` key `ams_activity_draft`. Current drafts are browser-local.

Documents step does not upload a file.

Edit: title, date, amount, funder, voucher, allowed status transitions. Only planned and ongoing.

---

## Backend (DEPENDENCY — Finance API)

Location: `/home/peter/Projects/MOH/Dev/inv/backend`

Port: **3000**. Express + Prisma + PostgreSQL.

Local Wave 0 database: `ims_db` on port **5435** (5432 was already occupied by another Postgres that did not accept the Finance `ims` credentials).

AMS backend: **NOT IMPLEMENTED**. Do not treat Finance as a dedicated AMS service.

### Auth

- `POST /api/auth/login` — email or username + password, JWT
- `GET /api/auth/me`

JWT payload includes `permissions: []`. `requireModule('Finance')` allows empty module, `All`, or `All modules`.

### Finance activity routes

Mounted at `/api/finance/activities` with `requireAuth` + `requireModule('Finance')`.

GET `/`, GET `/:id`, GET `/:id/timeline`, POST `/`, PATCH `/:id`, DELETE `/:id`, POST `/participants/import`, POST `/:id/report`.

Controllers: `finance.activities.controller.ts`. Service: `finance.activities.service.ts`. Shared rules: `finance.rules.ts`.

### Report routes

Mounted at `/api/finance/reports`. Listed in the frontend table above, plus CSV export URLs for flagged, participant/activity, and user amounts.

### Status transitions (CURRENT)

```
planned → ongoing | cancelled
ongoing → report_submitted | cancelled
report_submitted → closed | ongoing
closed → (none)
cancelled → (none)
```

There is no `completed` status. Report upload sets `report_submitted` and stores `reportPath`, including from `planned` or `ongoing`, and is rejected when already `closed`.

### Audit (PARTIAL)

`FinanceActivityEvent` rows are written on create/update/delete/report upload. `auditLog` middleware is a pass-through (`next()` only). This is not an immutable enterprise audit trail.

---

## Database (Finance PostgreSQL)

Inspected models relevant to AMS:

| Model | Role |
| --- | --- |
| FinanceActivity | Activity record. `participants` is JSON. `reportPath` is a string. |
| FinanceActivityEvent | Timeline rows |
| User | Login identity, `module`, `roleId` |
| Role | Name only |
| Department | Name/code |
| SystemSetting | Exists on Finance; AMS Administration does not use it |

**NOT IMPLEMENTED** in this schema: `ActivityParticipant` table, Accountability entity, Document entity, ComplianceFlag, notification tables.

There is no separate AMS database.

---

## Inventory application

Location: `/home/peter/Projects/MOH/inv`. Ports 5174 / 3001. Untouched in Wave 0.
