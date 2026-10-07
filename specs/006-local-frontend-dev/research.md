# Research: Local Frontend Development with a Fake Strava

Decisions behind [plan.md](plan.md). Wrangler behaviour was checked on 2026-10-07
with the repo's wrangler 4.147.

## R1. Where the fake Strava runs

**Decision**: Inside the local Worker, behind a separate **dev entry point**
`dev/worker.ts`, started with `wrangler dev dev/worker.ts`. The dev entry wraps
the existing exported handlers of `src/index.ts` (`handleFetch`, `handleQueue`,
`handleScheduled`). It answers the fake's own routes under `/_dev/` and passes
everything else to the app. Nothing under `src/` imports `dev/`.

**Rationale**:
- Every Strava call already goes through one place: `stravaFetch` in
  `src/strava/result.ts`, which calls the global `fetch` on `STRAVA_ORIGIN`. The
  test fake (`test/support/fake-strava.ts`) intercepts exactly there. So the dev
  entry can do the same and the app runs its normal code paths unchanged (FR-007).
- `wrangler dev [script]` takes the entry point as an argument and still reads
  every binding, var, queue, cron and asset setting from `wrangler.jsonc`. No second
  Wrangler config has to be kept in sync.
- Production deploys `main` from `wrangler.jsonc` (`src/index.ts`), so the fake is
  not in the production bundle at all. That is the strongest form of FR-009.
- One process and one port: the fake's pages are served from `localhost:8789`
  like the app.

**Alternatives considered**:
- *A separate fake server process on its own port, with a configurable Strava
  origin in `src/`*: needs a second process, a second port and a production code
  change (an origin setting that could be misconfigured in production).
- *A runtime flag in `src/` (e.g. `FAKE_STRAVA=1`)*: the fake would ship to
  production and only a variable would keep it off, which is weaker than FR-009 asks.
- *A Wrangler `env.dev` section with its own `main`*: `vars`, `d1_databases` and
  `queues` are not inherited by named environments, so most of `wrangler.jsonc`
  would have to be duplicated. `wrangler deploy --env dev` would also create a
  deployable Worker.
- *Build-time `--define`*: also keeps the fake out of production, but needs dead-code
  elimination to work and a global constant in `src/`. The separate entry is
  simpler.

## R2. Intercepting Strava calls

**Decision**: The dev entry replaces `globalThis.fetch` with a wrapper, checked
at the start of every handler call and installed again if something (e.g. a
test's `fetch` spy) replaced it. The wrapper sends requests for
`https://www.strava.com` to the fake handler and passes everything else to the
original `fetch`. The fake handler needs the local `DB` and the app's clock; the
wrapper gets both from the handler call that installed it.

**Rationale**: No change to `src/` is needed, and it is the same seam the tests use.
The wrapper never passes a Strava request through, so no request can reach Strava
even if the fake lacks an answer (FR-006).

**Alternatives considered**: Adding an injectable `fetch` to `Ctx`. That would
mean a production code change and touching every test's `makeCtx`, only to do
what the global seam already does.

## R3. The browser's trip to Strava's permission screen

**Decision**: `authorizeRedirect` in `src/http/auth.ts` sends the browser to
`https://www.strava.com/oauth/authorize?…`. The dev entry rewrites the `Location`
of any app response that starts with that URL to
`/_dev/strava/oauth/authorize?…`, with the same query. The stand-in screen there
lets the developer pick a sample rider and the granted scopes, or cancel. It then
redirects to the app's `redirect_uri` with `state`, `code` and `scope`, or with
`error=access_denied`, as Strava does.

**Rationale**: The app's own redirect logic stays untouched, and every callback
outcome (FR-008) is reachable: the required scopes withheld, the optional ones
withheld, cancelled, not a club member, and an expired state.

## R4. Fake state that survives reloads

**Decision**:
- **Stateless tokens and codes**: authorization codes, access tokens and refresh
  tokens encode the athlete ID, the granted scopes and the expiry, e.g.
  `fake-access.<athleteId>.<scopes>.<expiresAt>`. The fake decodes them instead
  of keeping them in memory. Revocation answers `200` and remembers nothing.
- **Activities** live in one table, `fake_strava_activities`, in the fake mode's
  local D1. The dev entry creates it with `CREATE TABLE IF NOT EXISTS`, and seeding
  fills it from the sample recipes (R6). It is not a migration: production never
  has it, because production never runs the dev entry.

**Rationale**: `wrangler dev` reloads the isolate on every code change (FR-003), so
in-memory state would be lost all the time. Riders would then hit `401`, be
refused a refresh and end up `needs_reconnect` after each edit. Stateless tokens
avoid that. Activities created by event triggers (US3) have to outlive a reload
because the daily re-read lists them again. Keeping all fake activities in one
table means one source for both.

**Alternatives considered**: A KV or extra D1 binding for the fake. That would
add a binding to `wrangler.jsonc` and so to production.

## R5. Settings, secrets and a separate local database

**Decision**:
- Fake mode starts with `--env-file dev/fake.env`, a committed file with synthetic
  values for the required secrets. The marker `RYNKE_FAKE_STRAVA=local-only` is
  passed with `--var` in the `pnpm dev` script (see below).
- Fake mode keeps its local state in `.wrangler/fake-state` (`--persist-to`). That
  directory is ignored like the rest of `.wrangler/`.

**Rationale**:
- Checked: when `--env-file` is given, `wrangler dev` reads that file and does
  **not** read `.dev.vars`. The developer's real Strava credentials therefore never
  reach fake mode (spec edge case). Fake mode also works on a fresh checkout without
  creating `.dev.vars` (SC-001).
- Found during implementation: because `wrangler.jsonc` declares `secrets`,
  Wrangler also merges the shell's environment over the env file, and keeps only
  the declared secrets from it. A shell exporting the real secrets would put them
  into fake mode, and the marker would be dropped. So `pnpm dev` unsets the
  declared secrets for Wrangler (`env -u …`) and passes the marker with `--var`.
- The synthetic keys are like the ones `vitest.config.ts` already commits. They
  protect nothing real, and Principle I's "no secrets in git" is about real
  secrets.
- A separate database keeps sample riders apart from anything a real-Strava local
  run stored. The real-Strava database may hold the maintainer's own rides, and
  it is encrypted with a different key. Resetting fake mode can't touch it.

**Alternatives considered**: Overriding the Strava credentials in code while
keeping `.dev.vars`. Rejected because the developer would still have to create
`.dev.vars`, and real credentials would be loaded into fake mode.

## R6. Sample riders and how they get into the database

**Decision**: A fixed list of sample riders in `dev/fake-strava/samples.ts`. Each
has a synthetic athlete ID (990001…), a first name that names the state, the scopes
it connects with, club membership, an optional fake behaviour, and a ride recipe.
**Seeding** works like this:
1. It clears the fake mode database: deletes all riders (everything else cascades)
   and resets the `strava_rate_limit` row.
2. It fills `fake_strava_activities` from the recipes. The recipes are dated back
   from the seeding day, the day of the app's clock (`ctx.now()`), never before
   the season start.
3. It connects every sample rider through the app's real flow: `POST /connect`
   with consent, then the stand-in screen's choice, then `GET /auth/callback`. The
   dev entry runs these as internal requests to `handleFetch` with the state cookie.

The app's queue then imports and evaluates as usual (FR-012). Seeding runs
automatically on the first request when `fake_strava_activities` doesn't exist,
and again on **Reset** (`POST /_dev/reset`, a button on `/_dev/`, FR-013).

**States** (spec US2), with how each is reached without special app code:

| State | How |
|---|---|
| Import still running | The fake answers this rider's activity list with `429` (no rate headers), so the app keeps deferring the import page and the import stays `pending` |
| No rides | Empty recipe |
| Far from the thresholds | A few short rides |
| Training target reached | Enough rides for ≥ 250 Training Rynke, none virtual. Still not in: Team Rynke come only from team events |
| Training target reached only thanks to virtual rides | Over 250 in total but under 167 without `VirtualRide` |
| Rides that don't count | Rides too slow, too fast, too long paused, climbing too fast, manual, flagged, e-bike, and an overlapping pair. A run is in the recipe too: the app imports only cycling, so it never appears |
| More rides than one page | 45 rides (paging is 20 per page) |
| Optional permissions withheld | Connects without `activity:read_all` and `activity:write`; has private rides the fake hides from it |
| Must reconnect | Sign-in works, but the fake refuses this rider's activity calls (`401`) and refresh (`400`), so the import marks it `needs_reconnect` |
| Not a club member | Its clubs don't include `STRAVA_CLUB_ID`; signing in shows the not-member notice and stores nothing |

Riders who are in, team events, corrections and "being recalculated" are left
out. Being in needs 25 Team Rynke, and Team Rynke come only from team events. The app has no
stored team events or corrections yet: `extras` is always `NO_EXTRAS`. "Being
recalculated" means a balance whose rules version differs from
`CURRENT_RULES.version`, and only version 1 exists. Faking either would mean
writing rows the app can't produce, which FR-012 rules out. The spec was updated
to say so.

**Alternatives considered**: Inserting riders and balances directly with SQL.
Refresh tokens are encrypted with the key from the env, and the numbers would be
hand-written rather than computed (FR-012).

## R7. Port, reload and debugging

**Decision**:
- `"dev": { "port": 8789, "host": "localhost:8789" }` in `wrangler.jsonc`. It only
  affects `wrangler dev`, so both local modes use 8789 without a flag (FR-001).
  Without `host`, `wrangler dev` hands the Worker URLs on the first route's host
  (the production domain), so the OAuth `redirect_uri` would point there and the
  dev entry's host guard would refuse every request. If the port is taken,
  Wrangler fails to start with "Address already in use"; it doesn't name the
  port, but nothing else is listening on 8789 in this project.
- Fake mode starts with `--live-reload`: Wrangler rebuilds on save, and open HTML
  pages reload themselves (FR-003, SC-003).
- `--test-scheduled` exposes `/__scheduled`, so the developer can run the daily
  cron by hand.
- Server-side debugging comes for free: Wrangler's DevTools inspector (key `d`
  in the dev session, default port 9229) works with breakpoints in `src/`.
  Nothing is configured for it (spec assumption).

## R8. Simulating Strava's events

**Decision**: The `/_dev/` page has a form per sample rider: new ride (date, sport
type, distance, elevation, moving and elapsed time, private), change a ride, delete
a ride, and revoke access. Each action first changes `fake_strava_activities` where
needed. It then sends Strava's webhook JSON as an internal `POST` to
`/strava/webhook/<STRAVA_WEBHOOK_VERIFY_TOKEN>`, using `STRAVA_SUBSCRIPTION_ID`
from the env. The real handler acks and enqueues, and the queue does the rest
(FR-014). Sending the same event twice is a "send again" button, for idempotency
checks (US3 scenario 3).

## R9. Making production use impossible (FR-009)

**Decision**: Three layers, the first two covered by tests:
1. **Not in the production bundle**: no file under `src/` imports from `dev/`. A
   test reads every `src/**/*.ts` as raw text through Vite's `import.meta.glob`
   (`?raw`) and fails on any import of `dev/`. It also checks that
   `wrangler.jsonc`'s `main` is `src/index.ts`. If `import.meta.glob` turns out not
   to work in the Workers test pool, use Biome's `noRestrictedImports` for `src/`
   instead, which `pnpm lint` and CI run.
2. **The dev entry refuses to run outside fake mode**: its `fetch`, `queue` and
   `scheduled` handlers throw unless `env.RYNKE_FAKE_STRAVA === "local-only"`. That
   value comes only from the `pnpm dev` script's `--var`, which `wrangler deploy`
   never sees.
   `fetch` also answers `403` unless the host is `localhost`, `127.0.0.1` or
   `[::1]`. So a mistaken `wrangler deploy dev/worker.ts` would serve nothing and
   process nothing.
3. **Scripts**: there is no deploy script for the dev entry, and `pnpm run deploy`
   and CI keep deploying `wrangler.jsonc`'s `main`.

## R10. Tests

**Decision**: Following Principle V (test-first), add two test files:
- `test/unit/dev-guard.test.ts`: the guards of R9 (layers 1 and 2).
- `test/integration/dev-fake-strava.test.ts`: an end-to-end smoke test of fake
  mode. Seed, run the queued messages through `handleQueue`, open `/me` as the
  "training target reached" sample rider and see its rides and balance. Also checks that an
  unknown Strava path gets a `404` and a log line, and that nothing reached the
  network (the setup's deny-all `fetch` stays in place under the fake).

The fake itself isn't covered endpoint by endpoint. It is dev tooling, and the
smoke test catches it drifting from the app, for example a new endpoint the app
calls that the fake doesn't answer. Existing tests keep their own fake
(`test/support/fake-strava.ts`) unchanged (spec assumption).

## R11. Developer-facing text

**Decision**: The `/_dev/` pages and the stand-in permission screen are in English
plain HTML. They are not part of the catalogs.

**Rationale**: They are developer tooling, never shown to riders. The
constitution's Language section requires catalogs only for user-facing text, and
the hard-coded copy guard only covers the rider pages.
