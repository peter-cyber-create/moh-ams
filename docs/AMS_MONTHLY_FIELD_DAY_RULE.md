# AMS monthly field-day rule

**Policy constant:** `MONTHLY_FIELD_DAY_LIMIT = 20`  
**Code:** `backend/src/domain/compliance/monthly.ts`

## Aggregation

For each Person (`personId`):

1. Take participation-eligible activities in the calendar year.
2. Compute inclusive duration days (`end − start + 1`, UTC).
3. Attribute those days to the **start month** of the activity.
4. Sum days per `(personId, year, month)`.

Do not confuse monthly totals with annual totals.

## Status

| Total | Status | Flag |
|---|---|---|
| &lt; 20 | `within_limit` | — |
| = 20 | `limit_reached` | `MONTHLY_LIMIT_REACHED` |
| &gt; 20 | `exceeded` | `MONTHLY_LIMIT_EXCEEDED` |

## Example

August 2026, Person A:

- Activity 1 = 5 days  
- Activity 2 = 7 days  
- Activity 3 = 10 days  
- **Total = 22 → `MONTHLY_LIMIT_EXCEEDED`**

## Warnings vs blocking

Exceeding 20 days produces a contextual warning and may contribute to `ACTION_REQUIRED` overall. It does **not** automatically reject activity submission.

## Interaction with annual rules

A person may have monthly `exceeded` and annual `EARLY_WARNING` / `THRESHOLD_REACHED` / `EXCEEDED` at the same time. Flags stay independent.
