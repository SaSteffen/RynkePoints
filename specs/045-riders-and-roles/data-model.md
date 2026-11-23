# Data Model: Riders and Roles in One Admin Tab

No migration, no new column, no new table. The merged tab reads what the Rider and Rollen tabs
read today ([research R3](research.md)).

## What one row needs

Read by one function in `src/db/riders.ts` that replaces `readRoles` and `readRiderOverview`:

| Field | From | Used for |
|---|---|---|
| `athleteId` | `riders.athlete_id` (as text) | the button's `data-athlete`, the removal address |
| `firstName` | `riders.first_name` | the row, the search (`data-name`, lower case), the sheet's title |
| `since` | `riders.role_since` | "Admin seit" / "In der Orga seit" (listed riders; NULL → no line) |
| `status` | `riders.status` | "Verbindung" in the sheet; the red line when `needs_reconnect` |
| `connectedAt` | `riders.connected_at` | "Verbunden am" in the sheet; a guest's sub-line |
| `membershipCheckedAt` | `riders.membership_checked_at` | "Mitgliedschaft zuletzt geprüft" (not for guests) |
| `importStatus` | `riders.import_status` | "Import" in the sheet; the red line when `pending` or `running` |

Nothing else is selected: no rides, Rynke, tokens or other identifiers (025 FR-019).

## Who is on the page

| Section | Rows | Role part in the sheet |
|---|---|---|
| Admins | listed riders with `administrator = 1`, `guest = 0` | yes |
| Orga | listed riders with `organiser = 1`, not administrators, `guest = 0` | yes |
| Ohne Rolle | the other listed riders, `guest = 0` | yes |
| Gäste | riders with `guest = 1` (listed or not, as on the Rider tab today) | no |

"Listed" is the existing definition of riders with a recorded consent (`SHARED_RIDER_IDS`); each
rider is in exactly one section (FR-004). Sorted by first name, case-insensitively, then ID.

Beside the rows, two counts for the note under Ohne Rolle: riders who have not agreed yet
(`guest = 0` and not listed) and the blocked IDs (`blockedCountStatement`). The count of listed
riders is the number of rows in Admins, Orga and Ohne Rolle together.

## Needs attention (derived)

`status = needs_reconnect` or `import_status IN ('pending','running')`. Shown in words on the
row and, red, in the sheet. No stored field.

## Unchanged

Role flags and their meaning, the writes of a role change and of a removal, the role card's
columns, the block list: as in features 043 and 025.
