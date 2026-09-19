# AMS activity input templates

## What to download

**Participant List** only — `AMS_Participant_List_Template.xlsx`

Activity information is entered in the AMS form (New Activity → Activity). Do not use a spreadsheet for Activity fields.

| Item | Value |
|---|---|
| Download | `GET /api/v1/activities/templates/participants` |
| UI | New Activity → Participants · More → Templates |
| Sheets | Participants · Instructions |

## Columns

| Column | Required |
|---|---|
| Name | Yes |
| Title | No |
| Organisation | No |
| Phone | No (recommended) |
| Amount | No |

Legacy `days` is still accepted by the importer if present. Field days for compliance come from Activity start/end dates.

## Workflow

Download → fill participants → save .xlsx → upload on Participants step → AMS validates → invalid rows reported → valid rows become ActivityParticipants on save/submit.

## Removed

Activity Details Excel template and import endpoints were removed from the normal workflow (form entry replaces them).
