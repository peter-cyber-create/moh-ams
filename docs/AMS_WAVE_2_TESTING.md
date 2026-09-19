# AMS Wave 2 testing

## Backend (in-memory repository)

`backend` `npm test` includes:

- Domain: distinct return / clarification / reject transitions; `ACC-YYYY-NNNNNN`; 60-day due; overdue ignores settled statuses; officer vs reviewer vs ICT permissions
- Application: create, get, update draft, submit, assign, reviewer queue access, return + resubmit, clarification + response, approve without auto-close, reject, invalid PATCH status, unauthorized review, wrong reviewer, duplicate open case, closed immutability, due-date default, activity relationship, document upload, timeline, unique references, submit without evidence

Activity Wave 1 tests remain.

## Frontend

`frontend` `npm test` includes:

- Nav label **Accountability** (not “Activity reports”)
- Status labels for `under_review`, `clarification_requested`, `returned`, `approved`, `rejected`
- Existing activity report / legacy due tests unchanged (`needsActivityReport` is still an **activity** concept)

## Manual UI checks

- My accountabilities / Due / Overdue / Awaiting review queues load from `/api/v1/accountabilities`
- Case page shows reference, activity, amounts, due date, status, documents, comments, timeline
- Submit / Return / Clarification / Resubmit / Approve / Reject / Close
- Unauthorized buttons may be hidden; API still returns 403
- Empty and loading states on the list page
- Activity report upload remains on the **activity** detail documents tab
- Creating a case from an activity does not mark the activity approved or closed
