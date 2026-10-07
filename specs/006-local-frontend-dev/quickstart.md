# Quickstart: Local Frontend Development with a Fake Strava

How to run the app locally without Strava and check that fake mode works. Routes and
commands are in [contracts/dev-routes.md](contracts/dev-routes.md), and the fake's
answers are in [contracts/fake-strava.md](contracts/fake-strava.md).

## Prerequisites

- `pnpm install` done.
- Port 8789 free. Nothing else is needed: fake mode doesn't read `.dev.vars`.

## 1. Automated checks

```bash
pnpm exec vitest run test/unit/dev-guard.test.ts test/integration/dev-fake-strava.test.ts
pnpm lint && pnpm typecheck && pnpm test
```

| Check | Where | Expected |
|---|---|---|
| FR-009 layer 1 | `dev-guard.test.ts` | No `src/**/*.ts` imports from `dev/`; `wrangler.jsonc` `main` is `src/index.ts` |
| FR-009 layer 2 | `dev-guard.test.ts` | Without `RYNKE_FAKE_STRAVA=local-only`, the dev entry's `fetch`, `queue` and `scheduled` throw. With it, host `rynke.example` gets `403` and `localhost` doesn't |
| FR-005, FR-007, FR-012 | `dev-fake-strava.test.ts` | Seeding connects every sample rider except Noah NotMember. After the queued messages are processed, Quinn Qualified's `/me` shows the qualified summary and their rides. Ida Importing's import is still `pending`, and Remy Reconnect is `needs_reconnect` |
| FR-006 | `dev-fake-strava.test.ts` | The test setup's deny-all `fetch` saw nothing, and `strava_rate_limit` is unchanged |
| FR-010 | `dev-fake-strava.test.ts` | An unknown Strava path gets `404` and an `UNANSWERED` log line |

## 2. Run it

```bash
pnpm dev
```

Expected: pending migrations are applied to `.wrangler/fake-state`, then Wrangler
reports `Ready on http://localhost:8789` and loads `dev/fake.env` (not `.dev.vars`).

1. Open `http://localhost:8789/_dev/`. The first request seeds; after a few
   seconds the list shows the sample riders as connected.
2. Click **Connect as** next to *Quinn Qualified*, then **Authorize**. You land on
   `/me` with Quinn's balance (qualified) and rides.
3. Edit a German string in `src/i18n/messages/de.ts` and save. The open page
   reloads with the new text (SC-003).
4. Go back to `/_dev/`, connect as *Paula Paging* and page through 45 rides. Do the
   same for the other states (SC-004).
5. Connect as *Olli OptionalDenied* and untick a required scope on the stand-in
   screen. You see the same notice a real rider would see. Try **Cancel** too.
6. As *Fiona FarAway*, add a new ride on `/_dev/` with 120 km. Reload `/me`: the
   ride and the higher tally appear. Press **send again**: nothing changes
   (idempotent).
7. As any rider, send **revoke access**. Their data is gone and `/me` sends you to
   `/`.
8. **Reset sample data** brings everything back to step 1's state.

Throughout, the terminal shows `[fake-strava] …` lines for every answered request,
and no request goes to Strava (SC-002).

Port taken? `pnpm dev` fails and names port 8789. Free the port; the app doesn't
move to another one.

## 3. Optional: debugging server code

In the Wrangler dev session press `d` to open DevTools. Breakpoints in `src/` hold
while you use the pages. This uses Wrangler's inspector port (default 9229), not
8787.

## 4. Against the real Strava (maintainer only)

`pnpm dev:strava` runs the app as `pnpm dev` used to: with `.dev.vars`, the
default local state `.wrangler/state` and the real Strava (feature 001
[quickstart §2](../001-strava-connect-webhook/quickstart.md)), now on port 8789.
It uses the app's Strava request budget, so use it only when you need real data.
