# AMS Wave 1 — Activity domain design

Inspected 14 August 2026 against the live Finance source (`Dev/inv/backend`) and AMS frontend (`activities-tracker/frontend`). This document is the implementation contract. No Accountability domain. No engines.

## 1. Domain purpose

AMS owns **Activity**: a Ministry of Health field/office activity with a budget, funding source, participants, and an optional **activity report** file.

Finance `FinanceActivity` remains in place as a historical source. After migration, **AMS tables are the source of truth**. The frontend talks only to the AMS Activity API for activity work.

## 2. Activity lifecycle

Keep the real Finance states. Add **`draft`** only, so incomplete work is not an official activity.

```
draft            unpublished; officer can save, resume, edit, submit, or discard
  → planned      official activity (wizard Submit, or POST submit)

planned → ongoing | cancelled
ongoing → report_submitted | cancelled
report_submitted → closed | ongoing
closed → (none)
cancelled → (none)
```

| Status | Meaning | Not meaning |
| --- | --- | --- |
| `draft` | Server-side unpublished form | Official activity |
| `planned` | Registered, not started | Approved / awaiting approval |
| `ongoing` | Work in progress | Report received |
| `report_submitted` | An **activity report file** is on record | Accountability approved, Accountability closed, Activity completed |
| `closed` | Activity closed after a report | Accountability case closed |
| `cancelled` | Cancelled from planned or ongoing | Deleted |

Activity report upload (except `closed`, `cancelled`, `draft`) sets `report_submitted`. That is an Activity-owned submission, not Accountability.

Default list queries **exclude** `draft`.

## 3. Activity entity

| Field | Role | Notes |
| --- | --- | --- |
| `id` | required | New AMS id (cuid) |
| `financeActivityId` | legacy | Unique link to Finance row; not deleted |
| `title` | required on submit | From `FinanceActivity.title` |
| `description` | optional | Free text |
| `requestedBy` | optional | Parsed from packed Finance description when present |
| `location` | optional | Parsed from packed Finance description when present |
| `departmentId` | optional / legacy | Finance department id, **no FK** across databases |
| `departmentName` | optional | Wizard “Department / division” (today often only in description) |
| `activityDate` | optional | From `invoiceDate` (that column is the activity date, not an invoice) |
| `endDate` | not in Wave 1 | UI does not collect it |
| `budgetAmount` | required on submit | From `amount`; drafts may be 0 |
| `funder` | optional | Funding source |
| `referenceNumber` | optional | From `voucherNumber` |
| `activityType` | optional / legacy | Rarely used |
| `days` | optional / legacy | Activity-level days; participant days live on participants |
| `status` | required | See §2 |
| `createdById` | required | Finance/AMS identity id (snapshot, not a live Finance FK) |
| `createdAt` / `updatedAt` | required | |

Derived in the API DTO (not stored as source of truth):

- `invoiceDate` — alias of `activityDate` for the current UI
- `voucherNumber` / `vocherno` — alias of `referenceNumber`
- `amount` / `amt` — alias of `budgetAmount`
- `hasActivityReport` — true if an `activity_report` document exists
- `reportPath` — latest report `storedPath` (compatibility only)
- `participants` — loaded from `ActivityParticipant`

## 4. Participant relationship

Current data is **not** a system User. It is a named person on an activity (name, title, phone, amount, days), stored as JSON.

Wave 1 model: **`ActivityParticipant`** (activity-owned row). No Person master — none exists in Finance or AMS.

Identity key for reporting/compliance remains `phone|name` (lowercased), computed at query time. Not a stored Person id.

Migration expands JSON into rows. Empty/malformed entries are recorded in the validation report; named rows are never dropped.

## 5. Activity documents

| Kind | Wave 1 |
| --- | --- |
| `activity_report` | Yes. Replaces `reportPath` as source of truth |
| `supporting` | Table supports it; wizard still does not upload at register |

Files stay on local disk (`backend/uploads/reports`). That is **not** a document platform. Physical files from Finance are copied when the path exists.

## 6. Activity events

`ActivityEvent` is **activity history**, not enterprise audit.

Actions preserved: `CREATED`, `UPDATED`, `STATUS_CHANGED`, `REPORT_UPLOADED`, `SUBMITTED`, `DISCARDED`, plus migrated Finance actions (`DELETED` is not replayed as a live AMS delete of migrated rows).

## 7. User relationship

Authentication stays **Finance JWT** (transitional).

AMS does not FK to Finance `User`. AMS stores `IdentityUser` snapshots (`id` = Finance user id, email, name, module, roleName, departmentName, isActive).

On each Activity API request: verify JWT with the shared secret → load snapshot → if missing, `GET /api/auth/me` on Finance and upsert.

`createdById` on Activity is that snapshot id.

## 8. Department relationship

Wizard department is free text today. AMS stores `departmentName` (and optional `departmentId` from Finance when present). No AMS Department table in Wave 1.

## 9. API design

AMS API process: port **3020**.

Versioned prefix: **`/api/v1`**.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/activities` | `activity:view` |
| GET | `/api/v1/activities/:id` | `activity:view` (+ ownership unless `view_all`) |
| POST | `/api/v1/activities` | `activity:create` |
| PATCH | `/api/v1/activities/:id` | `activity:edit` |
| POST | `/api/v1/activities/:id/submit` | `activity:submit` (draft → planned) |
| DELETE | `/api/v1/activities/:id` | `activity:create` (draft discard only) |
| GET | `/api/v1/activities/:id/timeline` | `activity:view` |
| POST | `/api/v1/activities/:id/report` | `activity:report` |
| PUT | `/api/v1/activities/:id/participants` | `activity:edit` |
| POST | `/api/v1/activities/participants/import` | `activity:create` |
| GET | `/api/v1/reports/activities` | `activity:view` |
| GET | `/api/v1/reports/funding` | `activity:view` |
| GET | `/api/v1/reports/person` | `activity:view` |
| GET | `/api/v1/reports/missing-report` | `activity:view` |
| GET | `/api/v1/reports/flagged` | `activity:view` |
| GET | `/api/v1/reports/participant-activity` | `activity:view` |
| GET | `/api/v1/reports/amounts` | `activity:view` |
| GET | `/health` | public |

Permissions (derived from module + role; not a registry product):

- `activity:create`, `view`, `edit`, `submit`, `report`, `close`, `cancel`, `view_all`, `manage`

Finance module / empty module / Admin / All: officer set. Reviewer/auditor: `view_all` + `close`. Admin: `manage` (all). ICT-only: 403.

Pagination, `search`, `status`, `funder`, `sort` are server-side. Default sort `createdAt desc`. Default list excludes drafts unless `status=draft`.

Controllers never import Prisma. Domain never imports Express/Prisma/React.

## 10. Migration strategy

1. `pg_dump` Finance `ims_db` (port 5435) to `backups/`.
2. Create AMS database `ams_db` on the same Postgres instance (not Inventory, not port 5432).
3. Copy `IdentityUser` from Finance `User` + `Role` + `Department`.
4. Copy each `FinanceActivity` → `Activity` (preserve timestamps; new AMS id; store `financeActivityId`).
5. Expand `participants` JSON → `ActivityParticipant`.
6. If `reportPath` set → `ActivityDocument` kind `activity_report` and copy file when present.
7. Copy `FinanceActivityEvent` → `ActivityEvent`.
8. Validate counts (see `AMS_WAVE_1_MIGRATION_VALIDATION.md`).
9. **Do not delete** `FinanceActivity`.

## 11. Compatibility strategy

- Frontend uses `/api/v1/activities` and `/api/v1/reports/*` only for activity work.
- Login remains `POST /api/auth/login` on Finance (Vite proxy).
- Activity JSON keeps aliases (`invoiceDate`, `reportPath`, `participants` array) so the current UI does not need a redesign.
- Finance `/api/finance/activities` may keep running; AMS UI must not call it after cutover.

## 12. Rollback strategy

1. Point Vite `/api/v1` proxy back to unused, and restore `/api` → Finance :3000 (documented command).
2. Restore frontend to Finance paths if a hotfix is required (git).
3. Restore `ims_db` from `backups/` if Finance data was altered (Wave 1 does not alter Finance rows).
4. Drop or leave `ams_db`; Finance remains source if AMS is taken offline.

FinanceActivity is never dropped in Wave 1, so rollback does not require reconstituting activities from AMS.
