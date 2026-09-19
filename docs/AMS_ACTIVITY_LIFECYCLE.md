# AMS activity lifecycle (Wave 1)

Source of truth: AMS `Activity.status`.

```
draft → planned → ongoing → report_submitted → closed
planned → cancelled
ongoing → cancelled
report_submitted → ongoing
```

`draft` is unpublished. It does not appear in the default activity list or the activity-report due queue.

`report_submitted` means an **activity report file** is stored as `ActivityDocument` kind `activity_report`. It does not mean Accountability approved, Accountability closed, or Activity completed.

Closing is only allowed from `report_submitted` (permission `activity:close`).
