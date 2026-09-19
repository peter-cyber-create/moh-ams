# AMS Wave 4 testing

## Backend

`npm test` in `backend` includes Wave 3 plus:

- Person matching: unique phone attaches; name-only never auto-merges; ambiguous phone stays uncertain
- Same name / different phones → two Persons
- Same person / different phone formatting → one Person
- Officers cannot `person:link`; ICT cannot search Persons
- Person with no IdentityUser is valid
- `POST merge` is 501
- Accountability create sets `personId` via `ensureForUser`
- Mandatory acceptance uses **personId** after explicit `link-user` (not name matching)
- Duration provenance: `DATE_CALCULATED` / `LEGACY_STORED_DAYS` / `DEFAULTED` / `NEEDS_REVIEW` / `CROSS_YEAR_REVIEW`
- 150-day and pending/overdue accountability rules unchanged

## Frontend

`npm test` in `frontend` includes:

- Compliance nav for reviewer, hidden for officer
- No Persons item in primary nav
- Quality empty-state copy
- Server-side query builder

## Manual

- Activity participants → Open Person
- Accountability case → Responsible Person
- Compliance list shows `PER-000001` and drills to `/persons/:id`
- Data quality tab (reviewer): missing phone, name-only, missing end date, cross-year, unlinked users
- Import still returns valid/invalid/duplicates/missing identity, plus matched/new/ambiguous/needs review
