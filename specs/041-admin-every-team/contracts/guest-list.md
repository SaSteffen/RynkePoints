# Contract: the guest list

**Feature**: [spec.md](../spec.md) | **Research**: R2, R4, R6

## `guests`

| | |
|---|---|
| Table | `guests (athlete_id INTEGER PRIMARY KEY)` |
| Migration | `migrations/0030_guests.sql`, add only |
| Meaning | the person may sign in to this team's site as a guest (FR-001, FR-003) |
| Read | at sign-in (`handleCallback`) and with the rider row on every request (`readViewer`) |
| Written by the app | never |
| Who belongs on it | administrators of another team only (FR-002); the maintainer keeps it so |

## Adding and removing

| Where | How |
|---|---|
| Production | `pnpm wrangler d1 execute DB --remote --env <team> --command "INSERT OR IGNORE INTO guests (athlete_id) VALUES (<id>)"`; `DELETE FROM guests WHERE athlete_id = <id>` removes |
| `pnpm dev:strava` | the same with `--local` |
| `pnpm dev` | the seed lists each team's sample guest (research R13) |
| Tests | a test helper inserts the ID |

To see who is listed: `SELECT athlete_id FROM guests`. To see who signed in as a guest:
`SELECT athlete_id, first_name FROM riders WHERE guest = 1`.

These are manual production steps the maintainer runs (constitution Development Workflow). A real
athlete ID goes only into these commands, never into the repository (Principle I).

## Effects

| Change | When it takes effect |
|---|---|
| ID added | the person's next sign-in on that team's site |
| ID removed | the guest's next request is treated as a visitor's; the next daily run deletes their data there, without revoking (FR-004) |
| Home administrator flag cleared | nothing on its own: the maintainer also removes the ID from every other team's list (FR-002) |

## Maintainer documentation

`docs/how-it-runs.md`, next to "Being an administrator", gains the commands above and the FR-002 rule:
clearing someone's administrator flag at home means removing them from every other team's guest list
in the same sitting.
