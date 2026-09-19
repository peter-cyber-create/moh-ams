# AMS Wave 4 — Person domain design

Inspected 14 August 2026. Wave 3 compliance still aggregates participation by normalized phone/name and joins Accountability via unique name match. That is transitional and is replaced here.

## What Wave 4 is

An AMS-owned **Person** directory so ActivityParticipant, IdentityUser, Accountability, and Compliance share a stable `personId`.

## What Wave 4 is not

Notifications, rule engine, workflow engine, event bus, HR/IAM replacement, national ID, Person merge, Inventory.

Finance JWT remains authentication. Person is the business identity.

## Concepts

| Concept | Meaning |
| --- | --- |
| IdentityUser | Who signed in (Finance account) |
| Person | Who the business person is (`PER-000001`) |
| ActivityParticipant | Snapshot of participation on one activity, plus `personId` |
| Accountability.submittedById | Which **user** submitted the case |
| Accountability.personId | Which **Person** is responsible |

A participant may have no login. A login user may have no participation. Linking is optional and authorized.

## Matching (conservative)

1. Existing `personId`
2. Unique normalized phone
3. Unique email
4. **Never** auto-merge on name alone

Uncertain matches become `unverified` / `ambiguous` / `needs_review`. See `AMS_IDENTITY_MATCHING.md`.

## Merge

**Not implemented.** Linking is supported. Canonical merge of two Persons is a future wave.

## Permissions

| Permission | Officer | Reviewer | Admin |
| --- | --- | --- | --- |
| `person:view` / `person:search` | yes (activity context) | yes | yes |
| `person:create` (manual) | no | no | yes |
| `person:edit` | no | no | yes |
| `person:link` | no | yes | yes |
| `person:merge` | unused | unused | unused |

Import may create Persons as a system effect of `activity:create`.
