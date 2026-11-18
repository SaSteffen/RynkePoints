# Contract: sign-in, roles and removal for guests

**Feature**: [spec.md](../spec.md) | **Research**: R4, R5, R7, R8

## `GET /auth/callback` (`handleCallback`)

Order of checks; changes in **bold**.

| Step | Not on the guest list | On the guest list |
|---|---|---|
| Code exchange | as today | as today |
| Blocked | `/notice/blocked`, **no revoke** | the same: the block wins |
| Required scopes missing | `denied` / `denied-deleted`, **no revoke** | the same |
| New person without the current consent | `consent-required`, **no revoke** | the same |
| Club check | as today; not a member: `not-member` / `not-member-deleted`, **no revoke**; inconclusive and new: `strava-busy`, **no revoke** | **skipped** |
| Store | insert or update; **`guest = 0`** | insert or update with **`guest = 1`** |
| Credentials, import | as today | as today in R1 outcome A; **none** in outcome B (R10) |
| "One team" notice | as today | **never** |
| Arrival | as today | as today |

No refusal at sign-in revokes the exchanged token any more (R5); it is never stored.

## Roles on every request (`readViewer`, `toRider`)

| Row | Viewer | `organiser` | `administrator` |
|---|---|---|---|
| `guest = 0` | rider | stored flag | stored flag |
| `guest = 1`, on the list | rider | **true** | **true** |
| `guest = 1`, off the list | **visitor** | – | – |

## Revocations (`revokeStoredToken`)

For a row with `guest = 1` it sends nothing to Strava and answers `ok`. Callers unchanged:

| Path | A guest |
|---|---|
| `POST /me/disconnect` | data deleted, grant kept, the usual "deleted" notice |
| `POST /admin/riders/<id>/remove` | data deleted, ID blocked, grant kept; "removed" |
| `delete-rider` (`guest-removed`, expired reconnect) | data deleted, grant kept |

## `GET /admin/riders`

The team's riders as today, then a group of guests (first name, status, connected, import), each
marked as a guest with a remove link like any rider. The "others" count leaves guests out. Text
keys for the group heading and the mark go into all ten catalogs (FR-013); they say "guest" and
never name the guest's team.

## Daily run (`scheduled`)

| Step | Change |
|---|---|
| Club check fan-out | riders with `guest = 0` only |
| New: guest sweep | `delete-rider` with reason `guest-removed`, `revoke: false`, for every `guest = 1` row whose ID isn't on the list |
