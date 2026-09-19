# AMS Person identity model

## Person

Stored fields supported by current data:

- `id` (internal)
- `personReference` immutable `PER-000001`
- `fullName`
- `phone` (as entered)
- `phoneNormalized` (digits / Uganda `256…`, indexed, **not unique**)
- `email` (from IdentityUser when linked)
- `organisation` / `title` (from participant title/org)
- `departmentId` / `departmentName` (from IdentityUser when known)
- `identityStatus`: `confirmed` \| `unverified` \| `ambiguous` \| `needs_review`
- `identityUserId` optional unique FK to `identity_user`
- `status`: `active`
- timestamps

No national identifier column exists in AMS today. Do not invent one.

## ActivityParticipant

Keeps `name`, `phone`, `title`, `amount`, `days` as the **activity snapshot**. Adds `personId` (nullable only for legacy rows that failed resolution). Identity for compliance is `personId`.

## Accountability

Keeps `submittedById` (submitter user, audit). Adds `personId` (responsible Person). Wave 4 business process: they are the same Person when the submitter’s IdentityUser is linked; the columns remain distinct.

## IdentityUser

Unchanged authentication snapshot. Linked from Person via `identityUserId`. One user ↔ at most one Person.
