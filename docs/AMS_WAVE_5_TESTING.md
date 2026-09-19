# AMS Wave 5 testing

## Backend

Domain (`backend/src/domain/compliance/wave5.test.ts`):

- Monthly: under 20, exactly 20, over 20  
- Early warning: 119, 120–149, 150, 151  
- Overlap: date ranges, same person, different persons, name-only potential  
- Warning message coverage  

Service acceptance (`backend/src/application/compliance/compliance.service.test.ts`):

1. Person A: 120 annual + 15 August + pending → +5 days → EARLY_WARNING + MONTHLY_LIMIT_REACHED + PENDING; +10 → MONTHLY_LIMIT_EXCEEDED; overlapping activity → OVERLAP_DETECTED, `blocking: false`  
2. Person B: 145 + 5 → 150 THRESHOLD_REACHED; +6 → 151 EXCEEDED  
3. Person C: monthly 10+10=20 within; +1 → 21 exceeded  
4. Closed accountability does not stay pending in preview  
5. ICT / unauthorized preview → 403  

Also covered: different months/years, person identity aggregation, simultaneous monthly + annual flags.

Run:

```bash
cd backend && npm test
```

## Frontend

- `frontend/src/lib/compliance.test.js` — query filters (year, month, earlyWarning, monthlyLimit, overlap)  
- `frontend/src/lib/compliancePreview.test.js` — inclusive days + threshold constants  

Run:

```bash
cd frontend && npm test
```

## Manual acceptance checklist

- [ ] Monthly 20-day calculation  
- [ ] Annual 150 unchanged  
- [ ] 120 early warning  
- [ ] 150 / &gt;150 flagged  
- [ ] Monthly + annual coexist  
- [ ] Overlap detected, not auto-rejected  
- [ ] Name-only treated conservatively  
- [ ] Pending / overdue accountability visible independently  
- [ ] Preview on register + edit; date change recalculates  
- [ ] Home indicators drill down  
- [ ] Compliance filters server-side  
- [ ] Inventory untouched  
- [ ] No rule / workflow / event / notification engines  
