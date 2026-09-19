# AMS Person migration (Wave 4)

## Before schema change

Create a full `ams_db` dump (never `ims_db`):

```bash
cd backend
bash src/scripts/backup-ams.sh
```

Record:

| Metric | How |
| --- | --- |
| Person count | 0 before Wave 4 |
| ActivityParticipant count | `select count(*) from activity_participant` |
| Unique phones | distinct non-null phone |
| Unique names | distinct lower(trim(name)) |
| Rows without identity | name-only (null/blank phone) |
| Duplicate phone candidates | same normalized phone, different names |
| IdentityUser count | `identity_user` |
| Accountability count | `accountability` |
| Sample compliance totals | Wave 3 participation days for known people |

## Schema

Prisma migration `20260814190000_person_directory`:

- `person`, `person_event`, `person_sequence`
- `activity_participant.person_id` (nullable FK)
- `accountability.person_id` (nullable FK)

No Activity or Accountability business columns were dropped. `submitted_by` remains.

## Backfill (conservative)

`npx tsx src/scripts/backfill-persons.ts`

1. Each IdentityUser → Person (`ensureForUser`), unique email attach if safe
2. Each ActivityParticipant without `personId`: unique phone attach, otherwise **new** Person. Name-only never merges.
3. Each Accountability without `personId`: Person of `submittedById`

Ambiguous phones create a Person with `identityStatus=ambiguous` rather than merging.

## This environment (14 August 2026)

Pre-migration dump: `backups/ams_db-wave4-pre-20260814T151018Z.dump`

| Metric | Before | After |
| --- | --- | --- |
| Person | 0 | 7 |
| ActivityParticipant | 2 | 2 |
| Unique phones | 1 | 1 |
| Unique names | 2 | 2 |
| Name-only participants | 1 | 1 (now `PER-000007` unverified) |
| Participants without `personId` | 2 | 0 |
| IdentityUser | 5 | 5 (all linked) |
| Accountability | 0 | 0 |

7 Persons = 5 IdentityUsers + 1 phoned participant (`PER-000006` Test Person) + 1 name-only participant (`PER-000007` Pat). The Finance login user was **not** merged with Test Person (no shared phone or email). That is the conservative rule.

Activity count remained 3. No FinanceActivity / `ims_db` changes.
