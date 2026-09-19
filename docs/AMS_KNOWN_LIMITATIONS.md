# AMS known limitations

Wave 5 facts:

- Monthly field-day limit is 20 days per person per calendar month (start-month attribution). Annual 150 and early warning at 120 are independent flags.
- Pre-submission compliance preview warns; it does **not** auto-reject. No notification engine — warnings are in-app / contextual only.
- Overlap detection is review-only (`OVERLAP_DETECTED` / `POTENTIAL_PARTICIPANT_OVERLAP`). Name-only identities are never auto-merged.
- Inventory remains untouched. No rule engine, workflow engine, event bus, or scheduler.

Wave 4 facts:

- Person is the AMS business identity (`PER-000001`). Compliance aggregates by `personId`, not normalized name.
- `IdentityUser` remains the login account. Linking is optional. Officers cannot merge or reassign identity (`person:link` is reviewer/admin).
- Person merge is **not** implemented (501). Name-only participants are never auto-merged.
- Accountability keeps `submittedById` (who submitted) and adds `personId` (responsible Person).
- Participation provenance is labeled (`DATE_CALCULATED` / `LEGACY_STORED_DAYS` / `DEFAULTED` / `NEEDS_REVIEW`). Day numbers and the 150-day rule are unchanged from Wave 3.
- Cross-year activities still count in the start year and are marked `CROSS_YEAR_REVIEW`.
- Notifications, rule engine, workflow engine, and event bus are not implemented.
- Login remains Finance JWT.

Wave 3 facts:

- Participation days = inclusive calendar duration from Activity start/end. Exactly 150 days is `threshold_reached`; above is `exceeded`.
- Accountability pending/overdue uses real Accountability rows, not `report_submitted`.

Wave 0 text below is historical in places (AMS now has its own backend). Wave 2 facts:

- Accountability is a real case domain. `report_submitted` is still only an activity-report status.
- Due date uses a transitional 60-day constant (`ACCOUNTABILITY_DUE_DAYS`). Not a rule engine.
- No notifications, workflow engine, reopen, or enterprise audit.
- Login remains Finance JWT. JWT `permissions` is still `[]`; AMS derives permissions from module + role.
- Accountability documents: pdf/doc/docx, 5MB, metadata only (no OCR / virus platform / version engine).

## CURRENT / PARTIAL

- Role navigation is computed in the browser. JWT `permissions` is always `[]`.
- API authorization is Finance module membership (or empty / All modules). It is not enterprise RBAC.
- Activity timeline events exist. `auditLog` middleware does nothing.
- Compliance is a live read model over Person-linked participation and Accountability. There is no stored flag, no job, and no rule engine.
- Reporting is direct Prisma queries. `GET /api/finance/reports/accountability` lists activities that still need a report file (legacy due logic). It does not mean Accountability cases.
- File upload exists only for the activity report. The registration wizard file picker does not upload.
- Participants are relational (`activity_participant`) with optional `personId`.
- Current drafts are browser-local.
- Report upload can move `planned` or `ongoing` to `report_submitted` without using the transition map. Closed activities cannot receive a report.
- Administration screens are placeholders. Templates page offers the Participant List Excel download only (Activity fields use the form).
- Person merge is deferred.
- `person:create` / `person:edit` are admin-only in the AMS role mapping; JWT still has empty `permissions`.

## NOT IMPLEMENTED

- Notification engine
- Enterprise audit engine
- Document management platform
- Workflow engine, rule engine, event bus, outbox, CQRS, search engine, dashboard engine, configuration registry
- Person merge
- National identity / HR system
- IAM replacement

## FUTURE

Those items belong to later authorized waves. Wave 5 does not implement notifications. A later wave may add optional email/SMS alerts for thresholds — still not a full notification engine unless explicitly authorized.

