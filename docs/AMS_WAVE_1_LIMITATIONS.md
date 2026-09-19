# AMS Wave 1 limitations

## CURRENT

- AMS owns Activity, ActivityParticipant, ActivityDocument, ActivityEvent in `ams_db`.
- Frontend activity screens call `/api/v1/activities` and `/api/v1/reports/*`.
- Drafts are `Activity.status = draft` on the server. A browser copy is kept only if the server save fails.
- Activity report is an `ActivityDocument` (`kind = activity_report`), not Accountability.
- Authorization is enforced on the Activity API from module + role. JWT `permissions` is still `[]`.

## DEPENDENCY (transitional)

- Login: Finance `POST /api/auth/login` on port 3000.
- JWT verification uses the Finance secret. First-seen users are hydrated from Finance `GET /api/auth/me`.
- `IdentityUser` is a snapshot, not a live FK to Finance `User`.

## PARTIAL

- Files are stored on local disk (`uploads/reports`). Not a document platform.
- Registration wizard still does not upload supporting files before submit.
- Compliance is still a hardcoded 150-day sum of `ActivityParticipant.days`. Not a rule engine.
- Reporting is direct queries on AMS tables. Not CQRS / a reporting engine.
- Activity history is not an enterprise audit trail.
- Department is a name string (plus optional Finance department id). No AMS Department master.
- No Person master; participants are activity-owned rows.

## NOT IMPLEMENTED

- Accountability domain
- Workflow / rule / notification engines
- Event bus, outbox, CQRS
- AMS-owned login/user administration
- Templates

## FUTURE

Wave 2 should be Accountability, after this Activity domain stays stable.
