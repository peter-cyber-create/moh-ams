# AMS Wave 3 testing

## Backend

`npm test` in `backend` includes:

- Inclusive duration; end before start
- `< 150` / `= 150` / `> 150`
- Pending vs draft/approved/closed/rejected
- Phone/name identity; no merge of phone vs name-only
- Import valid / invalid / duplicate / missing identity
- Year independence
- ICT 403
- Mandatory acceptance: 40+50+60 = 150 flagged; +10 = 160 exceeded; overdue accountability independent; close removes accountability flag only
- Participants are not auto-flagged for another officer’s case

## Frontend

`npm test` in `frontend` includes:

- Compliance nav for reviewer, hidden for officer
- Server-side query builder (year, search, overdue)
- Empty-state copy
- Flag tones

## Manual

- `/compliance` tabs Summary / Participation / Accountabilities
- Year filter and search
- Drill-down explains days and accountability references
- Home participation-flag count for reviewers
- Register: end date + import rejection reasons
