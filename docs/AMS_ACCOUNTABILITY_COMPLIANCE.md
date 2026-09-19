# AMS accountability compliance (Wave 3)

Uses Wave 2 Accountability records only. Not inferred from `reportPath`, Activity status, or Activity Report.

## Status buckets

| Bucket | Statuses |
| --- | --- |
| Draft (not pending) | `draft` |
| **Pending** | `submitted`, `under_review`, `returned`, `clarification_requested`, `resubmitted` |
| **Cleared** | `approved`, `closed` |
| **Rejected** | `rejected` |

`isPendingAccountability(status)` is exactly the pending set. **Not** every non-closed status.

Returned and clarification-requested **are** pending (the case is still open).

Approved is accepted but not closed; it is **cleared** for compliance (no pending/overdue flag). Draft is unpublished and is not a pending flag.

## Overdue

`isOverdueAccountability(status, dueDate, now)` =

pending **and** `dueDate < now`.

Days outstanding = calendar days from due date to now, only when overdue.

## Responsible person

`accountability.submittedById` → `identity_user`.

This is the officer who created/submitted the case, **not** every `ActivityParticipant` on the linked activity.

Wave 3 does **not** implement “every participant must account.”

## Combined person view

Accountability flags attach to a participation identity only when the IdentityUser **name** (normalized) uniquely matches one participation identity’s display name, and uniquely matches one user.

Otherwise the accountability row is shown on its own (unlinked) so two different people are not merged.
