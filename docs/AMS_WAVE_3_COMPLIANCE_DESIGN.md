# AMS Wave 3 — Compliance design

Inspected 14 August 2026 against AMS Activity (`activity_participant`) and Accountability (`accountability.submitted_by`). No Rule Engine, workflow engine, event bus, or Inventory changes.

## Separate concepts

| Concept | Source |
| --- | --- |
| Who participated | `activity_participant` |
| Activity report | `activity_document` kind `activity_report` / status `report_submitted` |
| Accountability case | `accountability` |

`report_submitted` does **not** create or imply an Accountability.

## Participation

- No second participant table.
- Days are calculated from Activity `activityDate` (start) and `endDate` (inclusive). See `AMS_PARTICIPATION_CALCULATION.md`.
- Annual totals use the **calendar year of the start date**. 2027 does not include 2026.
- Draft and cancelled activities are excluded.
- Identity: phone when present, else normalized name. See that doc. Uncertain matches are flagged, not merged.

## Accountability compliance

- Uses real Accountability rows only.
- **Responsible person** = `submittedById` (IdentityUser). Participants on the activity are **not** auto-flagged.
- Pending / overdue definitions: `AMS_ACCOUNTABILITY_COMPLIANCE.md`.

## Combined view

One operational table. Participation flags and accountability flags are independent. Overall status is derived from both and never replaces the details.

Join rule: unique normalized **name** between a participant identity and an IdentityUser. If the name is not unique, rows stay separate and are marked for review.

## Architecture

```
src/domain/compliance/       policy: days, year, 150, pending, overdue, identity
src/application/compliance/  query service (read model)
src/infrastructure/          prisma + memory repositories
src/presentation/            /api/v1/compliance/*
```

Calculations are centralized and testable. They are **not** a rule engine.

## Authorization

`compliance:view` for reviewer, auditor, admin, or role name containing `compliance`. Officers and ICT receive 403.

## UI

Existing shell. `/compliance` has Participation / Accountabilities tabs plus summary and drill-down. Home shows live counts only for users who can open Compliance.
