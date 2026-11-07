# Contract: Dev Commands

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | All registered teams in fake mode, in parallel; from release 3 also the local gateway and the shared fake Strava |
| `pnpm dev:hamburg` | Hamburg alone, in fake mode with its in-process fake Strava |
| `pnpm dev:europe` | Europe alone, likewise |
| `pnpm dev:strava` | Unchanged: Hamburg against the real Strava with `.dev.vars` |

Each team script is one line: `"dev:<id>": "node scripts/dev.mjs <id>"`. `"dev"` is
`node scripts/dev.mjs`. Which teams exist comes from the registry (FR-051).

## Per team

1. Apply local D1 migrations into `.wrangler/fake-state-<id>`.
2. Start `wrangler dev dev/worker.ts [--env <id>] --env-file dev/fake.env
   --var RYNKE_FAKE_STRAVA:local-only --persist-to .wrangler/fake-state-<id>
   --port <port> --host <host>:<port> --inspector-port <inspector> --live-reload
   --test-scheduled`, with the Strava secrets unset as `pnpm dev` does today.
3. Seed that team's synthetic riders (`dev/fake-strava/samples.<id>.ts`) on first start,
   as today.

## Ports

| Process | Port | Inspector |
|---|---|---|
| Hamburg | 8789 | 9230 |
| Europe | 8790 | 9231 |
| Gateway (release 3) | 8791 | 9232 |
| Fake Strava (release 3) | 8792 | 9233 |
| e2e test server (unchanged) | 8797 | 9237 |
| e2e Europe smoke | 8798 | 9238 |

## Output and stopping

- Every line is prefixed `[<id>]` (or `[gateway]`, `[strava]`).
- After start: one line per team, e.g. `hamburg → http://localhost:8789`,
  `europe → http://europe.localhost:8790`.
- Ctrl+C or SIGTERM stops every child. A child that exits non-zero stops the others, and
  the script exits with that code.
- A port already taken: stop before starting anything and name the port and team.

## Isolation

Cookies ignore ports, so teams get separate hostnames instead: the founding team keeps
`localhost:8789`, every other team runs on `<id>.localhost:<port>` (e.g.
`europe.localhost:8790`). Browsers resolve `*.localhost` to the loopback address, and
host-only cookies of one name never reach another, so being signed in on one team's site
doesn't sign you in on another's (US8 scenario 4). No cookie or code changes for this.
