# AMS multiple activity workflow

Each Activity remains an independent database record. No combined multi-activity entity.

## Flow

```
+ Add Multiple Activities
     ↓
Activity 1 / 2 / 3 …   (expandable cards)
     ↓
Participants           (separate list per activity; optional explicit copy)
     ↓
Check all activities   (Wave 5 preview per activity)
     ↓
Review warnings        (overlaps = review only, not auto-reject)
     ↓
Submit selected
```

## Overlaps

Same Person on overlapping date ranges → `OVERLAP_DETECTED` warning. `blocking: false`.

## Batch check summary

Compact per-activity status (ok / warn / alert) with drill-down to full compliance preview. Changing dates clears the check until “Check all” runs again.
