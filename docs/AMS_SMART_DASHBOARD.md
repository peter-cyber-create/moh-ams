# AMS Smart Dashboard

## Purpose

Home answers: **what needs my attention?** — not a wall of KPIs.

## Endpoint

`GET /api/v1/dashboard/home` (authenticated)

Server-side aggregation only. The browser does not download every Activity / Person / Accountability.

## Structure

1. Greeting + caught-up or attention subtitle  
2. **Action required** — overdue, returned, clarification, review, limit issues (hidden when count is 0)  
3. **Upcoming / due** — accountabilities due + activities in the next 7 days  
4. **Participation watch** — early warning / threshold / exceeded / monthly issues  
5. **Recent activities**  
6. **Recent accountability**  
7. **Quick actions** — role-filtered (new activity, multiple, review, compliance)  
8. Administrators also see a short operational summary + link to System  

## Priority order

1. Overdue  
2. Returned / clarification / review  
3. Limit exceeded / monthly  
4. Early warning (lower)  
5. Informational  

## Role personalization

Same layout; different counts from existing authorization:

- **Officer** — own/accessible cases and activities  
- **Reviewer** — review queue + compliance watch  
- **Administrator** — system-wide lists where permissions allow + operational summary  

## Refresh

Normal HTTP reload when opening Home. After workflow actions, returning to Home reloads. Notification bell polls every 60s. No WebSockets.

## Smartness (real data only)

Counts and watch lists come from Accountability and Compliance services. Zero cards are omitted. No placeholder statistics.
