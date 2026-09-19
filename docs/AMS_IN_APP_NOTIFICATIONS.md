# AMS In-App Notifications

## Purpose

Tell the user **what happened**, **why it matters**, and **where to go**. Not email/SMS. Not an event bus or notification engine.

## Storage

Prisma model `Notification` (`notification` table):

| Field | Role |
|---|---|
| recipientUserId | Identity user id |
| type | Stable type string |
| title / message | Plain language |
| referenceType / referenceId | Related record |
| href | In-app path |
| dedupeKey | Spam prevention |
| isRead / readAt / createdAt | Read state |

Unique: `(recipientUserId, type, dedupeKey)`.

## API

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/v1/notifications` | List + unreadCount |
| POST | `/api/v1/notifications/:id/read` | Mark one read |
| POST | `/api/v1/notifications/read-all` | Mark all read |

Unread is **not** cleared merely by listing.

## Types

Lifecycle (created in `AccountabilityService`):

- ACCOUNTABILITY_SUBMITTED (assigned reviewer, if any)
- ACCOUNTABILITY_ASSIGNED
- ACCOUNTABILITY_RETURNED
- CLARIFICATION_REQUESTED
- ACCOUNTABILITY_RESUBMITTED
- ACCOUNTABILITY_APPROVED
- ACCOUNTABILITY_REJECTED
- ACCOUNTABILITY_CLOSED

State-based (created once on Home load via `DashboardService`, deduped):

- ACCOUNTABILITY_DUE_SOON (≤ 3 days)
- ACCOUNTABILITY_OVERDUE
- PARTICIPATION_EARLY_WARNING
- PARTICIPATION_THRESHOLD_REACHED
- PARTICIPATION_EXCEEDED
- MONTHLY_LIMIT_EXCEEDED
- ACTIVITY_OVERLAP_REVIEW (year rollup)

## Recipients

| Event | Recipient |
|---|---|
| Submitted (reviewer already set) | Reviewer |
| Assigned | Assigned reviewer |
| Returned / clarification / approved / rejected / closed | Submitter |
| Resubmitted | Current reviewer |
| Overdue / due soon / participation / overlaps | Viewing user (authorized) — one row per dedupe key |

## Deduplication

- Lifecycle: stable keys for assign/approve/reject/close; time-stamped keys for return/clarify/resubmit/submit so each action can notify again.  
- State: `overdue:{id}`, `early:{personId}:{year}`, `threshold:…`, `exceeded:…`, `monthly:{personId}:{year}:{month}`, `overlaps:{year}`, `due-soon:{id}:{date}`.  

Refreshing Home does **not** create duplicates for the same state key.

## UI

Top-bar bell with unread badge. Panel lists recent items; click opens `href` and marks that item read. Mark all as read supported.

## Out of scope

Email, SMS, message broker, workflow/rule engines, notifying every activity participant automatically.
