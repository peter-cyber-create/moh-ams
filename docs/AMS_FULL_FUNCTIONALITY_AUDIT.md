# AMS Full Functionality Audit

**Date:** 2026-08-27  
**Release:** AMS UI 2.6.0 (smart Home + in-app notifications)

## Scope

Production usability and end-to-end verification of Waves 0–5 plus:

- Smart operational Home dashboard
- In-app notification store and top-bar UI
- Help / Administration / System clarity

Inventory was **not** modified.

## Audit checklist

| Function | Status | Notes |
|---|---|---|
| Authentication (login/logout/expired/invalid) | WORKING | Finance JWT; friendly `errorMessage` |
| Unauthorized / ICT 403 | WORKING | Server permissions remain the boundary |
| Home | WORKING | Now `GET /api/v1/dashboard/home` (was client multi-fetch) |
| Activities list/create/edit/submit | WORKING | |
| Participant template / upload / validation | WORKING | Date-derived days; template days not authority |
| Multiple activities | WORKING | Independent drafts; overlap warnings |
| Compliance preview | WORKING | Pre-submit |
| Activity report upload | WORKING | Detail → Documents (activity report ≠ accountability) |
| Extra activity “supporting docs” beyond report | PARTIAL | Documents tab focuses on activity report; accountability docs are separate |
| Accountability lifecycle | WORKING | draft→…→closed; illegal transitions rejected |
| Reviewer assign / return / clarify / approve / reject / close | WORKING | + notifications |
| Person directory / profile | WORKING | |
| Compliance (monthly/annual/overlap/pending) | WORKING | |
| Reports hub | WORKING | Four categories |
| Templates | WORKING | Participant List only |
| Help | WORKING | Short FAQ |
| Administration | PLACEHOLDER (honest) | Explicitly unavailable; Finance owns users/roles |
| System | WORKING | Health + version + auth dependency |
| Notifications | WORKING | Persistent in-app; deduped |

## Broken / partial found and fixed

| Issue | Fix |
|---|---|
| Home showed zero-value attention cards | Smart Home hides empty action cards; shows caught-up state |
| Home aggregated in the browser from many endpoints | Server `DashboardService` |
| No notifications | `Notification` model + API + lifecycle hooks + bell UI |
| Help was long procedural text | Short FAQ answering the required questions |
| Admin looked like a module | Clear “not available” copy |
| System exposed raw `/health` framing | Plain-language Online / Version / Authentication |

## Known limitations

- Postgres must be reachable on **5435** for migrate/runtime (`ams_db`). Apply `20260827160000_in_app_notifications` before deploying.
- No email/SMS.
- Administration remains out of AMS (Finance identity).
- State-based participation/overdue notifications are created on dashboard load with dedupe keys (not an event bus).
- Browser E2E against live DB was not run in this environment when Postgres was down.

## Regression

Waves 0–5 business rules unchanged: monthly 20, early warning 120, threshold 150, person-based compliance, overlap warning, accountability lifecycle.
