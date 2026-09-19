# AMS current dependencies (Wave 2)

## CURRENT

- AMS frontend: Vite/React port **3010**
- AMS API: Express/Prisma port **3020**, database `ams_db` on Postgres **5435**
- Activity source of truth: AMS tables (`activity`, `activity_participant`, `activity_document`, `activity_event`)
- Accountability source of truth: AMS tables (`accountability`, …)
- Compliance read model: `/api/v1/compliance/*` over `activity_participant` + `accountability` (no second participant table, no FinanceActivity)

## DEPENDENCY (transitional authentication)

| Need | Provider |
| --- | --- |
| Login | Finance `POST /api/auth/login` port **3000** |
| JWT secret | Shared with Finance `.env` `JWT_SECRET` |
| User profile on first AMS request | Finance `GET /api/auth/me` |

## NOT a runtime Activity dependency

Finance `/api/finance/activities` and `/api/finance/reports/*` are **not** used by the AMS UI after Wave 1. `FinanceActivity` is retained for rollback only.

## Must remain separate

Inventory (`/home/peter/Projects/MOH/inv`, ports 5174 / 3001) is untouched.
