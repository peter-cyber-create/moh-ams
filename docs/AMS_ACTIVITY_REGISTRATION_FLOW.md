# AMS activity registration flow

Presentation simplification only. Domain rules unchanged.

## Three steps

```
NEW ACTIVITY
     ↓
01 ACTIVITY        (form: title, requested by, department, dates, location, amount, funder, voucher, description)
     ↓
02 PARTICIPANTS    (download template · upload · add manually)
     ↓
03 CHECK & SUBMIT  (review · Wave 5 compliance preview · change dates · confirm · submit)
```

Progress indicator shows only these three labels.

## Forms vs Excel

| Data | How entered |
|---|---|
| Activity | AMS form |
| Participants | Excel template upload (or manual add) |
| Activity report / accountability documents | After the activity exists (separate screens) |

## Single activity

Route: `/activities/register`

## Multiple activities

Route: `/activities/register-multiple` — see `AMS_MULTIPLE_ACTIVITY_WORKFLOW.md`.
