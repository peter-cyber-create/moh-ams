# AMS activity compliance preview

**Endpoint:** `POST /api/v1/compliance/preview`  
**UI:** Register activity (final step), Edit activity (live panel)

## Purpose

Answer: **“Who will be affected if I submit this activity?”** before final commit.

## Flow

1. Activity details  
2. Dates  
3. Participant upload / selection  
4. **Preview** (server recalculates)  
5. Review warnings  
6. Change start/end dates if needed  
7. Recalculate (no page reload)  
8. Explicit confirm  
9. Submit  

Submission is blocked in the UI until the officer confirms the preview. The API does **not** auto-reject.

## Preview content

- Activity title, start, end, calculated duration, participant count  
- Participants with early warning (120–149)  
- Participants at exactly 150 / over 150  
- Participants at/over monthly 20  
- Pending / overdue / returned / clarification accountabilities (by responsible Person)  
- Confirmed and potential overlaps  
- Participant impact table  

## Participant impact columns

| Column | Meaning |
|---|---|
| Current month days | Existing days in activity start month |
| Projected month days | Current + this activity |
| Current annual days | Existing year total |
| Projected annual days | Current + this activity |
| Accountability | Clear / Pending / Overdue / … |
| Overlap | Yes / No / Potential |
| Result | e.g. EARLY WARNING, MONTHLY LIMIT EXCEEDED, THRESHOLD, ACTION REQUIRED |

## Duration

Duration is always date-derived (inclusive UTC days). Changing dates recalculates days and impact. Manual unexplained duration overwrite is not supported.

## Recalculation example

John: current annual 123, activity 10 days → projected 133 (EARLY WARNING).  
Change activity to 5 days → projected 128. Preview updates immediately.

## Warnings are not rejection

`blocking: false` on the preview response. Ministry process retains final authority.
