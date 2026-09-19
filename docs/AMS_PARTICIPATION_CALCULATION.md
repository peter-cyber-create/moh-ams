# AMS participation calculation (Wave 3)

Not a rule engine. Deterministic helpers in `backend/src/domain/compliance/participation.ts`.

## Duration

Inclusive calendar days in UTC:

`days = (endDate UTC Y-M-D) − (startDate UTC Y-M-D) + 1`

| Inputs | Result |
| --- | --- |
| start and end, end ≥ start | inclusive days |
| start only | 1 day |
| end before start | invalid — excluded from totals, data-quality flag |
| no start | excluded from annual totals, data-quality flag |

`Activity.days` is stored as a snapshot of that duration. Compliance **recomputes** from dates. Spreadsheet `days` is **not** used when dates exist.

Activities that span two calendar years: all days count in the **start** year. The row is flagged `spans_years`. Wave 3 does not split days across years.

## Year

Calendar year of `activityDate` (start). 2026 totals never include 2027 rows. Historical years remain queryable. No counter reset job.

Excluded statuses: `draft`, `cancelled`.

## 150-day interpretation (explicit)

Threshold constant `PARTICIPATION_DAY_THRESHOLD = 150`.

| Total days | Status |
| --- | --- |
| `< 150` | `within_limit` (CLEAR / NEAR LIMIT if remaining ≤ 15) |
| `= 150` | `threshold_reached` — **flagged** |
| `> 150` | `exceeded` — **flagged** |

Exactly 150 is **not** treated as still within limit.

NEAR LIMIT is remaining 1–15 days, still `within_limit` for the threshold status, with an extra display flag.

## Identity

Current fields: `name`, `title`, `phone`. There is no national ID column. `title` may hold job title or organisation from import (`organisation` maps to `title` when title is empty).

1. Normalize phone to digits. Uganda `0XXXXXXXXX` → `256XXXXXXXXX`. `+256…` → `256…`.
2. If a normalized phone exists → key `phone:{digits}`. Same person even if the name spelling differs.
3. Else → key `name:{collapsed lowercase name}`. `"John Doe"` and `"JOHN DOE"` match.
4. A phoned identity is **never** merged with a name-only identity of the same display name (could be two people). Name-only rows are `identityQuality: name_only`. If that name also exists with a phone, both get `duplicate_identity_candidate`.
5. Two different phones with the same name are two people.

Phone limitations: shared phones, missing phones, and formatting errors can under- or over-count. Wave 3 does not invent a Person master.

## Import

`POST /api/v1/activities/participants/import` accepts `.xlsx` / `.xls` with columns (case-insensitive): `name`, `title`, `phone`, `identifier` (used if phone empty), `organisation` / `organization`, `amount`, `days`.

Every row is classified. Nothing is silently dropped. Valid rows are returned for the wizard; if `activityId` is present they are persisted onto that activity (`ActivityParticipant`). Duplicates in the file (same identity key) reject later rows.
