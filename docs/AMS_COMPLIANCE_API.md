# AMS Compliance API (Wave 3)

All routes require Finance JWT. `compliance:view` (reviewer / auditor / admin / compliance role). ICT and officers receive 403.

Server-side pagination, search, and filters. Default `year` = current UTC calendar year. `page` default 1, `limit` default 20, max 100.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/compliance/overview` | Combined table + `summary` counts |
| GET | `/api/v1/compliance/participation` | Participation ledger (people with activity days) |
| GET | `/api/v1/compliance/participation/:participantId` | Same as person drill-down |
| GET | `/api/v1/compliance/accountabilities` | Pending/overdue cases for responsible officers |
| GET | `/api/v1/compliance/participants/:participantId` | Combined person view + contributing activities |

`participantId` is the identity key (`phone:256…` or `name:john doe` or `user:{id}`), URL-encoded.

Query: `year`, `search`, `department`, `participationStatus` (`within_limit` \| `threshold_reached` \| `exceeded`), `accountabilityStatus` (`pending` \| `overdue` \| `returned` \| `clarification`), `overdue`, `exceeded`, `page`, `limit`.

Related: `GET /api/v1/activities/:id/participants` lists ActivityParticipant rows. `POST /api/v1/activities/participants/import` returns total/valid/invalid/duplicates/imported/rejected/reasons; persists when `activityId` is supplied.

Does **not** use FinanceActivity.
