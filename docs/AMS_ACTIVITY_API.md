# AMS Activity API

Base URL (dev): `http://localhost:3020`

Frontend proxy: `/api/v1` and `/health` and `/uploads` → 3020. Login remains `POST /api/auth/login` on Finance :3000.

Authentication: `Authorization: Bearer <Finance JWT>`. Transitional. AMS verifies the token with the shared `JWT_SECRET`, then loads `IdentityUser` (or Finance `GET /api/auth/me` on first use).

Authorization: permissions derived from module + role (`activity:create`, `view`, `edit`, `submit`, `report`, `close`, `cancel`, `view_all`, `manage`). ICT-only users receive 403.

## Endpoints

| Method | Path | Authz | Notes |
| --- | --- | --- | --- |
| GET | `/health` | public | `{ status, service: "ams-activity" }` |
| GET | `/api/v1/activities` | view | Query: `search`, `status`, `funder`, `page`, `limit`, `sort`, `order`. Default excludes drafts. |
| POST | `/api/v1/activities` | create | Body JSON. `status` `draft` or `planned`. |
| GET | `/api/v1/activities/:id` | view | Ownership unless view_all |
| PATCH | `/api/v1/activities/:id` | edit / close / cancel | Status changes use the transition map |
| POST | `/api/v1/activities/:id/submit` | submit | draft → planned |
| DELETE | `/api/v1/activities/:id` | create | Draft discard only |
| GET | `/api/v1/activities/:id/timeline` | view | Activity history |
| PUT | `/api/v1/activities/:id/participants` | edit | Replaces relational rows |
| POST | `/api/v1/activities/participants/import` | create | Spreadsheet preview `{ rows }` |
| POST | `/api/v1/activities/:id/report` | report | multipart `activityReport` pdf/doc/docx ≤ 5MB |
| GET | `/api/v1/reports/activities` | view | |
| GET | `/api/v1/reports/funding` | view | |
| GET | `/api/v1/reports/person` | view | |
| GET | `/api/v1/reports/missing-report` | view | Legacy due: no activity_report document |
| GET | `/api/v1/reports/flagged` | view | Hardcoded 150 participant days |
| GET | `/api/v1/reports/participant-activity` | view | |
| GET | `/api/v1/reports/amounts` | view | |

## Create / patch body

`title`, `description`, `requestedBy`, `location`, `departmentName`, `invoiceDate` or `activityDate`, `amount` or `budgetAmount`, `funder`, `voucherNumber` or `referenceNumber`, `status`, `participants[]` `{ name, title, phone, amount, days }`.

## Response activity DTO

Includes AMS fields plus UI aliases: `invoiceDate`, `voucherNumber`, `vocherno`, `amount`, `amt`, `reportPath` (derived), `hasActivityReport`, `participants` (from relation).

## Errors

`{ "error": "message" }` with 400 / 401 / 403 / 404 / 500.

## Migration compatibility

Finance `/api/finance/activities` is not used by the AMS UI after Wave 1. FinanceActivity rows are retained.
