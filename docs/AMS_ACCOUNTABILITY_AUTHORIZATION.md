# AMS Accountability authorization (Wave 2)

Enforced in `AccountabilityService`. The UI may hide buttons; the API does not trust the client.

## Permissions

Derived from Finance module + role name (same pattern as Activity). JWT `permissions` is still unused.

| Permission | Officer | Reviewer | Admin |
| --- | --- | --- | --- |
| `accountability:view` | yes | yes | yes |
| `accountability:create` | yes | no | yes |
| `accountability:submit` | yes | no | yes |
| `accountability:view_all` | no | yes | yes |
| `accountability:review` | no | yes | yes |
| `accountability:return` | no | yes | yes |
| `accountability:clarify` | no | yes | yes |
| `accountability:approve` | no | yes | yes |
| `accountability:reject` | no | yes | yes |
| `accountability:close` | no | yes | yes |
| `accountability:assign` | no | yes | yes |
| `accountability:manage` | no | no | yes |

Officer = Finance module (or empty) and **not** a reviewer/auditor role. ICT gets an empty set (403).

## Case access (`accountability:view`)

A user may open a case if any of:

- they submitted it
- they created the linked Activity
- they are the assigned `reviewerId`
- they have `view_all` or `manage`

## Role vs assignment

`accountability:review` answers “may this user review at all?”

`reviewerId` answers “which case is assigned to this reviewer?”

Approve / return / reject / request clarification require the **assigned** reviewer (or `manage`). Unassigned submitted cases appear in the reviewer queue; they must be assigned before a decision.

## Submitter actions

Create, update draft/returned lines, attach documents (not while in review), submit, resubmit, respond to clarification: submitter (or `manage`).

## Closed / rejected

Closed and rejected cases cannot be modified. Wave 2 does not implement reopen. After reject, a **new** case may be created for the same activity.
