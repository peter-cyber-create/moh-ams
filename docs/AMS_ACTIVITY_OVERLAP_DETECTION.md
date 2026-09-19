# AMS activity overlap detection

**Code:** `backend/src/domain/compliance/overlap.ts`  
**API:** `GET /api/v1/compliance/overlaps`  
**Also:** included in compliance preview and overview summary

## Confirmed overlap (`OVERLAP_DETECTED`)

Conditions (all required):

1. Date ranges overlap (inclusive UTC days).  
2. Same `personId` participates in both activities.  
3. Different activity IDs.

Returned fields:

- Activity A / Activity B titles and IDs  
- Overlap period (`overlapStart`–`overlapEnd`)  
- Person id and name  

## Potential overlap (`POTENTIAL_PARTICIPANT_OVERLAP`)

For unresolved / name-only participants:

- Same normalized name  
- At least one side lacks `personId` (or identities differ)  
- Overlapping dates  

Never auto-merged. Requires identity review before treating as the same Person.

## Policy

Overlap is a **warning / review** condition. Activities are not automatically rejected.

## Example

- Activity A: 01–10 September, Person D  
- Activity B: 05–15 September, Person D  
- Result: `OVERLAP_DETECTED`, overlap 05–10 September, Person D
