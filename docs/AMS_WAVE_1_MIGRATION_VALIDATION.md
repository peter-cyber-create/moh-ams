# AMS Wave 1 migration validation

Run: `npx tsx src/scripts/validate-migration.ts` (exit 0 when `ok: true`)

## Result 2026-08-14T14:23Z

```json
{
  "source": {
    "activities": 2,
    "namedParticipants": 1,
    "events": 4,
    "reports": 1
  },
  "target": {
    "migratedActivities": 2,
    "participants": 1,
    "reportDocuments": 1,
    "events": 4,
    "orphanCreators": 0,
    "duplicateFinanceIds": 0
  },
  "ok": true
}
```

Checks:

- Activity count Finance = AMS rows with `financeActivityId`
- Named JSON participants = `ActivityParticipant` on migrated activities
- `report_path` count = `ActivityDocument` kind `activity_report` on migrated activities
- No duplicate `financeActivityId`
- No orphan `createdById` (creator exists in `IdentityUser`)
- Status histogram compared (planned / report_submitted)

Event counts matched this run. They may differ if Finance events reference deleted activities; that is documented, not a silent drop of live activities.

FinanceActivity remains; rollback check count = 2.
