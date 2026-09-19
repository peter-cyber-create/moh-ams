# AMS Accountability lifecycle (Wave 2)

An **Accountability** is a financial case. An **Activity Report** (`report_submitted`) is not this lifecycle.

## States

| Status | Meaning |
| --- | --- |
| `draft` | Unpublished case. Officer may edit financial lines and documents. |
| `submitted` | Submitted for review. May still be unassigned. |
| `under_review` | Assigned (or already in review). Reviewer may decide. |
| `clarification_requested` | Reviewer asked a question. The case is **not** fully reset. |
| `returned` | The whole case must be corrected and resubmitted. Reason required. |
| `resubmitted` | Officer resubmitted after return. Usually moves immediately to `under_review` if a reviewer is assigned. |
| `approved` | Reviewer accepted the case. **Not** closed. |
| `rejected` | Formally declined. Terminal. Reason required. A new case may later be created for the same activity. |
| `closed` | Closed after approval. Immutable in Wave 2. No reopen. |

These three are distinct:

- **Returned** — correct the whole case, then resubmit.
- **Clarification requested** — answer a question; financial lines stay unless the officer already edited them in a returned state.
- **Rejected** — declined. Not a return.

## Transitions

```
draft → submitted → under_review → approved → closed
                              ↘ returned → resubmitted → under_review
                              ↘ clarification_requested → under_review
                              ↘ rejected
```

`submitted → under_review` also happens when a reviewer is assigned.

If the officer submits a draft that already has a reviewer, the case goes to `under_review`.

If the officer resubmits a returned case that already has a reviewer, the case goes to `under_review`.

Approval does **not** auto-close.

There is no `PATCH status=approved` (or closed, returned, …). Named application actions only.

## Who acts

| Status | Who must act |
| --- | --- |
| `draft`, `returned`, `clarification_requested` | Submitter |
| `submitted`, `resubmitted`, `under_review` | Reviewer |
| `approved` | Reviewer / administrator (close) |
| `rejected`, `closed` | Nobody |
