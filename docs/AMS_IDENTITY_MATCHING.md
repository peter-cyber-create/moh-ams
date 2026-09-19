# AMS identity matching (Wave 4)

Normalization (phone digits, Uganda `0XXXXXXXXX` → `256…`, collapsed lowercase names) is used **only to find candidates**. It does not by itself merge people.

## Auto-attach (safe)

| Signal | Action |
| --- | --- |
| Participant already has `personId` | Keep it |
| Exactly one Person with same `phoneNormalized` | Attach |
| Exactly one Person with same email (case-insensitive) | Attach |
| IdentityUser already has a Person | Reuse that Person for that user |

## Never auto-merge

- Same display name, no phone
- Same name, different phones
- Same phone already on **two** Persons (data error) → new Person `ambiguous`
- Name-only vs phoned namesake

Name-only participants each get a **new** Person with `identityStatus=unverified` (or `needs_review` if that normalized name already exists on another Person). Totals are not combined until an authorized `link-participant`.

## Import

File-level duplicate phone/name-key still rejects later rows. Directory resolve then: matched / new / ambiguous / needs_review counts.

## Linking

`POST /api/v1/persons/:id/link-user` and `link-participant` require `person:link` (reviewer or admin). Officers cannot merge or reassign identity. Each link writes a `PersonEvent`.
