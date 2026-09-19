# AMS 2.8.0 — Operational data & realistic seed

## Purpose

Enable AMS to hold richer activity operational data (teams, facilities, travel, budget lines) inspired by real MOH workbooks, without expanding the New Activity registration form. Populate a realistic demo dataset so the dashboard and reports show meaningful, database-derived statistics.

## Schema

Migration `20260903160000_activity_operational_data`:

- `activity_team`
- `activity_team_member` (rate, frequency, per diem, fuel, supplied vs calculated totals)
- `activity_facility` (region, district, facility)
- `activity_travel` (route, litres, fuel rate/amount)
- `activity_budget_line` (category, quantity, rate, supplied vs calculated)

## Seed

`npm run seed:demo` (`src/scripts/seed-demo-data.ts`)

Approximate counts after seed:

| Entity | Count |
| --- | ---: |
| Persons | 847 |
| Activities | 133 |
| Participants | 610 |
| Accountabilities | 87 |
| Teams | 60 |
| Facilities | 40 |
| Travel legs | 60 |
| Budget lines | 60 |

Includes planned/ongoing/report_submitted/closed/cancelled activities; draft→closed accountability lifecycles; 120/150 day and monthly 20-day compliance edge cases; intentional overlaps; supplied vs calculated financial discrepancies.

## Dashboard

`GET /api/v1/dashboard/overview` extended with:

- Activities: total, this month, ongoing, upcoming, awaiting report, reports submitted, recently closed
- Accountability: total, pending, under review, due, overdue, returned, clarification, approved, closed
- Participation: total people, monitored, early warning, threshold, exceeded, monthly, overlaps
- Financial totals + data-quality signals
- Attention-first section (non-zero only) + clear-state messages
- Month-over-month activity trend

All values from server-side aggregation / existing services — no hardcoded UI KPIs.

## UI

- Version **2.8.0**
- Fixed non-scrollable sidebar retained
- Dashboard reordered: Needs attention → Activities → Accountability → People → Financial → Upcoming/Recent
- No “Multiple Activities” nav item; `+ Add Activity` remains inside New Activity

## Inventory

Not modified.
