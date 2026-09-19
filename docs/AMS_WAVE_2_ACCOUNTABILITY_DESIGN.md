# AMS Wave 2 — Accountability domain design

Inspected 14 August 2026 against the Wave 1 AMS Activity API (`activities-tracker/backend`) and UI. Activity remains the source of truth for activities. This domain is **not** an Activity flag and **not** an Activity Report.

## 1. Purpose

An **Accountability** is a financial accountability **case**: money advanced for an activity must be accounted, reviewed, and decided.

An **Activity Report** (`ActivityDocument` kind `activity_report`, activity status `report_submitted`) is supporting evidence on the Activity. It is not approval, not compliance, and not case closure.

## 2. Creation trigger

Accountability is created **only when an authorized officer explicitly creates a case** (`POST /api/v1/accountabilities` with `activityId`).

It is **not** created when:

- an activity is registered
- an activity report is uploaded
- status becomes `report_submitted`

Eligibility to create:

- Activity exists in AMS
- Activity status is not `draft` or `cancelled`
- No other Accountability for that activity is still open (open = not `rejected` and not `closed`)

Existing `report_submitted` activities receive **no** historical Accountability rows (cannot reconstruct a real case from a file path).

## 3. Lifecycle

```
draft → submitted → under_review → approved → closed
                              ↘ returned → resubmitted → under_review
                              ↘ clarification_requested → under_review
                              ↘ rejected
```

`submitted → under_review` also happens when a reviewer is assigned.

| Status | Meaning |
| --- | --- |
| `draft` | Unpublished case. Officer may edit and discard. |
| `submitted` | Submitted for review; may be unassigned. |
| `under_review` | Assigned (or already in review). Reviewer may decide. |
| `clarification_requested` | Reviewer asked a question. Case is not fully reset. |
| `returned` | Whole case must be corrected and resubmitted. Reason required. |
| `resubmitted` | Officer resubmitted after return. In the review queue. |
| `approved` | Reviewer accepted the case. Not yet administratively closed. |
| `rejected` | Formally declined. Terminal. Reason required. |
| `closed` | Closed after approval. Immutable. |

`returned` and `clarification_requested` are distinct. `rejected` is distinct from both.

Approval does **not** auto-close.

No `PATCH status=…` for decisions. Only named actions.

## 4. Entity (implemented)

`Accountability`: `id`, `referenceNumber` (immutable `ACC-YYYY-NNNNNN`), `activityId`, `status`, `currency` (`UGX`), `amountAdvanced` (snapshot of activity budget at create), `amountReturned`, `dueDate`, `submittedById`, `submittedAt`, `reviewerId`, `assignedAt`, `assignedById`, `reviewedAt`, `approvedAt` / `approvedById`, `rejectedAt` / `rejectedById` / `rejectionReason`, `closedAt` / `closedById` / `closureReason`, `returnReason`, timestamps.

Not stored on the case (read from Activity): title, department, dates, participants.

## 5. Financial model

Current process records an activity budget and participant amounts. Wave 2 does **not** invent a chart of accounts.

- **Advanced** = `amountAdvanced` (activity budget snapshot)
- **Expenditures** = `AccountabilityLine` rows (`kind=expenditure`, description, amount)
- **Returned** = `amountReturned`
- **Accounted** = sum of expenditure lines (derived)
- **Outstanding** = advanced − accounted − returned (derived)
- **Variance** = (accounted + returned) − advanced (derived)

## 6. Documents, comments, clarifications, history

- `AccountabilityDocument` — supporting evidence for the **case** (not `ActivityDocument`)
- `AccountabilityComment` — return / review / approval / reject / close notes
- `AccountabilityClarification` — one question + one response per request
- `AccountabilityEvent` — domain timeline (not enterprise audit)

## 7. Due date

`dueDate = createdAt + 60 days` unless a date is supplied. Constant `ACCOUNTABILITY_DUE_DAYS = 60`. This is the former UI overdue window, documented as **transitional**, not a rule engine.

Overdue = `dueDate < now` and status not in `approved`, `closed`, `rejected`.

## 8. Assignment vs role

`accountability:review` = may review. `reviewerId` = **this** case’s reviewer. Unassigned submitted cases appear in the review queue; approve/return/reject/clarify require the assigned reviewer (or `manage`).

## 9. Access

- Officer: cases they submitted, or whose activity they created
- Reviewer: `view_all`, or assigned to them
- Admin: all

## 10. Architecture

Same boundary as Activity: presentation → application → domain ← infrastructure/Prisma. Domain does not import Express or Prisma.
