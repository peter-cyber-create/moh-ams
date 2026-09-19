# AMS Wave 1 migration

Timestamp (UTC): **2026-08-14T14:23:43Z**

## Source

- Database: `ims_db` on `localhost:5435` (Finance / IMS)
- Tables read: `"FinanceActivity"`, `finance_activity_event`, `"User"`, `"Role"`, `"Department"`
- Backup: `backups/ims_db-20260814T142343Z.dump` (pg_dump `-Fc`)
- FinanceActivity **not deleted**

## Target

- Database: `ams_db` on `localhost:5435` (AMS-owned)
- Schema version: Prisma migration `20260814120000_init_activity`

## Steps executed

1. `pg_dump` Finance `ims_db`
2. `CREATE DATABASE ams_db`
3. `npx prisma migrate deploy`
4. `npx tsx src/scripts/migrate-finance-activities.ts` (idempotent on `financeActivityId`)
5. `npx tsx src/scripts/validate-migration.ts`
6. Rollback check: FinanceActivity still present

## Record counts (after first run)

| Item | Finance | AMS |
| --- | ---: | ---: |
| Identity users | 5 | 5 |
| Activities | 2 | 2 migrated |
| Named participants | 1 | 1 |
| Activity report files | 1 | 1 |
| Timeline events | 4 | 4 |

Statuses copied: 1 `planned`, 1 `report_submitted`.

## Rollback

1. Keep using Finance (tables intact). Restore AMS UI proxy to Finance only if a hotfix is required.
2. Restore `ims_db` from `backups/ims_db-20260814T142343Z.dump` only if Finance itself was damaged (Wave 1 did not write Finance rows).
   `pg_restore -d ims_db backups/ims_db-20260814T142343Z.dump`
3. AMS `ams_db` can be dropped without destroying Finance.

Command to re-check Finance rows: `npx tsx src/scripts/test-rollback.ts`
