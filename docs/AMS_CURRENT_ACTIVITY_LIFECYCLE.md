# AMS current activity lifecycle (AS-IS)

This is the lifecycle the Finance service actually implements. It is not a workflow engine.

## Flow

```
Activity created
    → planned
        → ongoing
            → report_submitted
                → closed
```

Cancellation:

```
planned → cancelled
ongoing → cancelled
```

Also allowed by the current transition map:

```
report_submitted → ongoing
```

## Statuses that exist

- `planned`
- `ongoing`
- `report_submitted`
- `closed`
- `cancelled`

## Statuses that do not exist

- `completed`
- approval / pending approval
- returned
- clarification
- a separate Accountability case status

## How an activity is created

`POST /api/finance/activities` with `status: planned` (AMS wizard). That is a saved activity, not an approval request.

## How a report is submitted

`POST /api/finance/activities/:id/report` with field `activityReport`.

Allowed files: `.pdf`, `.doc`, `.docx`. Maximum size: 5MB. Stored under `backend/uploads/reports` and recorded as `reportPath` (`/uploads/reports/...`).

The upload path sets `status` to `report_submitted` unless the activity is already `closed`. It does not create an Accountability record.

## How an activity is closed

`PATCH /api/finance/activities/:id` with `{ status: "closed" }`, only from `report_submitted`.

## CURRENT LEGACY DUE LOGIC

An activity still needs an activity report when:

- `reportPath` is null or blank, and
- `status` is not `closed` or `cancelled`

Implemented once on the API as `isLegacyDue` / `pendingAccountabilityWhere` and once on the AMS frontend as `needsActivityReport`. The `/accountability` route is a queue of those activities plus `report_submitted` items. It is not a domain of its own.

## Drafts

Current drafts are browser-local (`localStorage`). They are not server-side drafts and not templates.

## Participants

Participants remain JSON on `FinanceActivity.participants`. They are not a normalized table.
