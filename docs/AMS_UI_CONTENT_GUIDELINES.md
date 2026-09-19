# AMS UI Content Guidelines

## Page purpose

Every page should answer:

1. What is this?  
2. What can I do here?  
3. What needs my attention?  

Prefer: heading → one-line explanation → table/list → primary action.

## Language

Use Ministry/business wording.

| Prefer | Avoid showing users |
|---|---|
| Under review | `under_review` as raw code in copy |
| Activity report | Calling the report an “accountability” |
| Field days / annual limit | Prisma, JWT, transition map, read model |
| Sign in again | AxiosError / stack traces |

Translate statuses with `statusLabel()`. Use `errorMessage()` for API failures.

## Navigation

Primary sidebar: Home · Activities · Accountability · Compliance · Reports · More  

More: Templates · Help · (Admin) Administration · System  

Do **not** promote Participants, Persons, Notifications, Overlaps as primary nav.

Top bar: title area · notifications · user · sign out.

## Cards vs lists

Cards only for actionable Home summaries. Use tables/lists for Activities, Accountabilities, People, Reports, Notifications.

## Empty / loading

- Loading: “Loading your work…” / “Loading notifications…”  
- Empty Home actions: “You're all caught up.”  
- Empty lists: short message + create action when allowed  

## Home

Hide zero-count attention cards. Lead with overdue and returned work. Participation watch only for people with real warnings.

## Accounts & access (Wave 6)

Administrators manage users under More → Administration. Officers and Reviewers use More → My profile to change passwords. Password fields support Show/Hide.
