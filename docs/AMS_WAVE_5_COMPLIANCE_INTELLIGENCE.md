# AMS Wave 5 — Compliance Intelligence & Pre-Submission Validation

**Date:** 27 August 2026  
**Version:** AMS 2.5.0  
**Scope:** Monthly 20-day limit, 120-day early warning, activity overlap detection, pre-submission compliance preview.  
**Non-goals:** Rule engine, workflow engine, event bus, notification engine, Inventory changes, AMS shell redesign.

## Architecture

Wave 5 extends the existing compliance read model (Waves 3–4):

| Domain | Role |
|---|---|
| Person | Identity source (`personId`) |
| Activity / ActivityParticipant | Participation days by person |
| Accountability | Pending / overdue / returned / clarification on the responsible Person |
| Compliance | Server-side aggregation + preview |

Independent flags may coexist on one Person:

- monthly limit
- annual early warning / threshold / exceeded
- pending or overdue accountability
- confirmed or potential overlap

Overall label may be `ACTION_REQUIRED`; flags are not collapsed into one opaque status.

## Monthly calculation

- Policy: `MONTHLY_FIELD_DAY_LIMIT = 20`
- Aggregation: `personId` + calendar year + calendar month
- Days attributed to the **activity start month** (same start-year style as Wave 3)
- Statuses: `within_limit` (&lt;20), `limit_reached` (=20), `exceeded` (&gt;20)

See `AMS_MONTHLY_FIELD_DAY_RULE.md`.

## Annual calculation

Unchanged from Wave 3:

- `ANNUAL_FIELD_DAY_LIMIT = 150`
- Inclusive UTC calendar days: `end − start + 1`
- `&lt;150` within limit; `=150` threshold reached; `&gt;150` exceeded

## 120-day early warning

- `ANNUAL_EARLY_WARNING_THRESHOLD = 120`
- `120–149` → `EARLY_WARNING` (distinct from Wave 3 `NEAR_LIMIT`)
- Does not replace threshold / exceeded semantics

## Overlap detection

Confirmed: same `personId`, overlapping date ranges, different activities → `OVERLAP_DETECTED`.  
Name-only / unresolved: `POTENTIAL_PARTICIPANT_OVERLAP` — never auto-merged.

See `AMS_ACTIVITY_OVERLAP_DETECTION.md`.

## Accountability interaction

Uses Wave 2 Accountability statuses. Participation and accountability flags remain independent (participant vs responsible Person).

## Preview workflow

```
INPUT → PREVIEW → COMPLIANCE CHECK → WARN → ADJUST DATES → RECALCULATE → CONFIRM → SUBMIT
```

Warnings never auto-reject. See `AMS_ACTIVITY_COMPLIANCE_PREVIEW.md`.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/compliance/preview` | Pre-submission impact |
| GET | `/api/v1/compliance/monthly` | Monthly roll-up |
| GET | `/api/v1/compliance/annual` | Annual participation (alias) |
| GET | `/api/v1/compliance/overlaps` | Confirmed + potential overlaps |
| GET | `/api/v1/compliance/overview` | Summary + filters (year, month, earlyWarning, monthlyLimit, overlap, …) |

Authorization: Finance viewers for lists; officers with create/edit may preview. ICT → 403.

## UI

- Register activity: last step is compliance preview (recalculate on date change, confirm before submit)
- Edit activity: live preview when dates change
- Home / My work: drill-down indicators (early warning, 150 flags, monthly, pending, overlaps)
- Compliance: Summary, Participation, Monthly, Overlaps, Accountabilities, Data quality + server-side filters

## Testing

See `AMS_WAVE_5_TESTING.md`. Backend Wave 5 domain + service acceptance tests; frontend helper tests.

## Inventory / engines

Inventory untouched. No rule / workflow / event / notification engines.
