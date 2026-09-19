# AMS Wave 2 migration

## Strategy

Schema only. **No backfill** of Accountability rows from existing Activity Reports.

Existing `report_submitted` activities keep their `ActivityDocument` (`kind=activity_report`). They do **not** become approved, closed, or even draft Accountabilities. A file path is not a reconstructable financial case.

If an officer later needs a case for that activity, they create one explicitly (`POST /api/v1/accountabilities`).

## What was added

Tables (Prisma migration `20260814170000_accountability_domain`):

- `accountability`
- `accountability_line`
- `accountability_document`
- `accountability_event`
- `accountability_clarification`
- `accountability_comment`
- `accountability_sequence` (year → last number for `ACC-YYYY-NNNNNN`)

`activity` gained a relation only. No Activity columns were dropped or rewritten.

## Indexes

`status+due_date`, `activity_id`, `reviewer_id+status`, `submitted_by`, `created_at`, unique `reference_number`, plus child-table indexes used by case reads.

One open case per activity is enforced in the application (`findOpenByActivity`), not as a unique constraint on `activity_id` (rejected/closed cases may be followed by a new case).

## Backup

Before `prisma migrate deploy`, dump `ams_db` (not `ims_db`). Finance data is not migrated in Wave 2.

Pre-migration dump: `backups/ams_db-wave2-pre-20260814T143857Z.dump`

After migrate: 3 existing activities preserved; `accountability` row count = 0 (no historical backfill).

## Rollback

Restore `ams_db` from the pre-migration dump. Do not drop `ims_db`. Do not delete `FinanceActivity`.
