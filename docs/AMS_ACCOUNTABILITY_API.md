# AMS Accountability API (Wave 2)

Prefix: `/api/v1/accountabilities`. Finance JWT via `requireAuth`. Versioned like Activity (`/api/v1`).

The queue is queried from this domain. It is **not** reconstructed by filtering Activity records.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/accountabilities` | Paginated list. Query: `view`, `status`, `search`, `activityId`, `reviewerId`, `department`, `page`, `limit`, `sort` (`createdAt` \| `dueDate` \| `referenceNumber`), `order` |
| POST | `/api/v1/accountabilities` | Create draft. Body: `activityId` (required), optional `dueDate`, `lines`, `amountReturned` |
| GET | `/api/v1/accountabilities/reviewers` | Users who may be assigned as reviewers |
| GET | `/api/v1/accountabilities/:id` | Case detail |
| PATCH | `/api/v1/accountabilities/:id` | Edit draft/returned financials only. **Cannot set status.** |
| POST | `/api/v1/accountabilities/:id/submit` | `draft` → `submitted` or `under_review` |
| POST | `/api/v1/accountabilities/:id/assign` | Body: `reviewerId` |
| POST | `/api/v1/accountabilities/:id/return` | Body: `reason` (required) |
| POST | `/api/v1/accountabilities/:id/clarification` | Body: `question` (required) |
| POST | `/api/v1/accountabilities/:id/clarification/:clarificationId/respond` | Body: `response` (required) |
| POST | `/api/v1/accountabilities/:id/resubmit` | `returned` → `resubmitted` / `under_review` |
| POST | `/api/v1/accountabilities/:id/approve` | Optional `note` |
| POST | `/api/v1/accountabilities/:id/reject` | Body: `reason` (required) |
| POST | `/api/v1/accountabilities/:id/close` | Optional `reason` |
| GET | `/api/v1/accountabilities/:id/timeline` | Domain history events |
| GET | `/api/v1/accountabilities/:id/documents` | Supporting documents |
| POST | `/api/v1/accountabilities/:id/documents` | Multipart field `document` (pdf/doc/docx, 5MB) |

## List `view` values

| `view` | Meaning |
| --- | --- |
| `mine` | Cases the actor submitted or whose activity they created |
| `due` | Not settled (`approved`/`closed`/`rejected`) and `dueDate >= now` |
| `overdue` | Not settled and `dueDate < now` |
| `review` | `submitted` / `under_review` / `resubmitted` assigned to the actor, plus unassigned if `view_all` |
| `returned` | `returned` |
| `clarification` | `clarification_requested` |

Server-side pagination: default page 1, limit 20, max 100.

## Create / submit rules

- Activity must exist and must not be `draft` or `cancelled`.
- Only one **open** case per activity (open = not `rejected` and not `closed`).
- Submit requires at least one expenditure line, and either an accountability supporting document **or** an activity report on the linked activity.

## Response shape (detail)

Includes `referenceNumber`, `activityId`, nested `activity` (`id`, `title`, `departmentName`, `createdById`, `hasActivityReport`), financial totals (`amountAdvanced`, `amountAccounted`, `amountReturned`, `outstandingBalance`, `variance`), `dueDate`, `overdue`, assignment fields, `lines`, `documents`, `clarifications`, `comments`, `nextActor`.

Activity title/department/participants are **not** copied onto the case master. They are read from Activity.
