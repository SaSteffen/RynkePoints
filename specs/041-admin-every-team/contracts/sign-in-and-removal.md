# Contract: sign-in, roles and removal for guests

**Feature**: [spec.md](../spec.md) | **Research**: R4, R7, R8, R14

## `GET /auth/callback` (`handleCallback`)

Order of checks; changes in **bold**.

| Step | Not on the guest list | On the guest list |
|---|---|---|
| Code exchange | as today | as today |
| Blocked | `/notice/blocked`, **withdrawn unless held** | the same: the block wins |
| Required scopes missing | `denied` / `denied-deleted`, **withdrawn unless held** | the same |
| New person without the current consent | `consent-required`, **withdrawn unless held** | the same |
| Club check | as today; not a member: `not-member` / `not-member-deleted`, **withdrawn unless held**; inconclusive and new: `strava-busy`, **withdrawn unless held** | **skipped** |
| Store | insert or update; **`guest = 0`** | insert or update with **`guest = 1`** |
| Credentials, import | as today | as today in R1 outcome A; **none** in outcome B (R10) |
| "One team" notice | as today | **never** |
| Arrival | as today | as today |

Every refusal after the code exchange withdraws the token just exchanged unless another team holds
the person ([withdrawal.md](withdrawal.md), R14). Nothing else of it is stored.

## Roles on every request (`readViewer`, `toRider`)

| Row | Viewer | `organiser` | `administrator` |
|---|---|---|---|
| `guest = 0` | rider | stored flag | stored flag |
| `guest = 1`, on the list | rider | **true** | **true** |
| `guest = 1`, off the list | **visitor** | – | – |

## Withdrawals

Every path that let a rider go and revoked their stored token now withdraws it unless another team
holds them ([withdrawal.md](withdrawal.md)); a guest is no exception:

| Path | A guest whose home team holds them | Anyone no other team holds |
|---|---|---|
| `POST /me/disconnect` | data deleted, grant kept | data deleted, grant withdrawn |
| `POST /admin/riders/<id>/remove` | data deleted, ID blocked, grant kept | the same, grant withdrawn |
| `delete-rider` (`guest-removed`, expired reconnect, left club) | data deleted, grant kept | data deleted, grant withdrawn |

## `GET /admin/riders`

The team's riders as today, then a group of guests (first name, status, connected, import), each
marked as a guest with a remove link like any rider. The "others" count leaves guests out. Text
keys for the group heading and the mark go into all ten catalogs (FR-013); they say "guest" and
never name the guest's team.

## Daily run (`scheduled`)

| Step | Change |
|---|---|
| Club check fan-out | riders with `guest = 0` only |
| New: pending revocations | every row of `pending_revocations` settled ([withdrawal.md](withdrawal.md)) |
| New: guest sweep | `delete-rider` with reason `guest-removed`, `revoke: true`, for every `guest = 1` row whose ID isn't on the list |
