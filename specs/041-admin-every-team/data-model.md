# Data Model: Administrators on Every Team's Site

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

One migration, `migrations/0030_guests.sql`, add only, so the previous release keeps working while
CI applies it before publishing the code (CLAUDE.md).

## `guests` (new): the guest list

| Column | Type | Rule |
|---|---|---|
| `athlete_id` | `INTEGER PRIMARY KEY` | A Strava athlete ID of an administrator of another team |

- Per team, in that team's D1. Nothing else: no name, no home team, no date (FR-012).
- Written by the maintainer only ([contracts/guest-list.md](contracts/guest-list.md)); the app reads
  it, never writes it.
- No foreign key: an ID is listed before the person signs in, and stays when they disconnect.

## `riders.guest` (new column): the guest mark

`guest INTEGER NOT NULL DEFAULT 0 CHECK (guest IN (0, 1))`

- Set by the app at every sign-in: 1 if the ID is on the guest list, else 0 (research R8).
- Not changed when the maintainer edits the list: the mark keeps the row out of every team count
  until the row is gone (R2).
- Deleted with the row; the schema's cascade deletes everything the guest owns, as for any rider.

## `Rider` (TypeScript, `src/db/riders.ts`)

| Field | Change |
|---|---|
| `guest: boolean` | new: `row.guest === 1` |
| `organiser` | `row.organiser === 1 \|\| guest` |
| `administrator` | `row.administrator === 1 \|\| guest` |

`riderStatement` also selects `on_guest_list` (R4); `readViewer` treats `guest && !on_guest_list` as
a visitor.

## States of a guest

```text
           maintainer adds ID           signs in (consent, Strava)
 (nobody) ───────────────────▶ listed ───────────────────────────▶ guest (row, guest = 1)
                                  ▲                                   │
                                  │ signs in again                    │ maintainer removes ID
                                  │                                   ▼
                                  └──────────────────────────── off the list (row, guest = 1):
                                                                  every request → visitor;
                                                                  daily run deletes the row,
                                                                  no revoke
 guest ── disconnects ──────────▶ row deleted, grant kept (R5); still listed
 guest ── removed by admin ─────▶ row deleted, blocked, grant kept; block wins over the list
 guest ── grant gone at home ───▶ needs_reconnect, deleted after 7 days, nothing revoked
```

## Delete reasons (`src/work/messages.ts`)

`DELETE_REASONS` gains `guest-removed` (daily run, `revoke: false`).

## Unchanged

`blocked_athletes`, `consent_records`, credentials, activities and everything derived from them keep
their shape. A guest's rows are ordinary rows; only the shared filter (R3) tells them apart.
