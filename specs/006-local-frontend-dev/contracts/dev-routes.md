# Contract: Dev Entry Routes and Commands

The dev entry `dev/worker.ts` answers the routes below itself and passes every other
request to the app's `handleFetch`. The pages are developer tooling in English
(research R11). All routes exist only in fake mode.

## Guards (every handler)

| Condition | Result |
|---|---|
| `env.RYNKE_FAKE_STRAVA !== "local-only"` | `fetch`, `queue` and `scheduled` throw `Error("fake Strava runs only in local fake mode")` |
| Request host not `localhost`, `127.0.0.1` or `[::1]` | `403`, plain text, nothing passed to the app |

## Routes

| Method & path | Does | Answers |
|---|---|---|
| `GET /_dev/` | Lists the sample riders with their state, whether they are connected, and a **Connect as** button each. Also offers **Reset sample data**, the event forms (below) and links to `/me` and `/__scheduled`. | `200` HTML |
| `POST /_dev/connect` (`athleteId`) | Starts the real connect flow for that rider: internally `POST /connect` with consent, then redirects the browser to the stand-in screen with that rider preselected | `303` to `/_dev/strava/oauth/authorize?…` |
| `GET /_dev/strava/oauth/authorize?client_id&redirect_uri&response_type&approval_prompt&scope&state[&athlete]` | The stand-in permission screen: a sample rider choice (preselected by `athlete`), one checkbox per requested scope (all ticked), **Authorize** and **Cancel**. Rejects a `client_id` other than fake mode's (`400`). | `200` HTML |
| `POST /_dev/strava/oauth/authorize` | **Authorize**: redirects to `redirect_uri?state=…&code=fake-code.<id>.<scopes>&scope=<ticked>`. **Cancel**: `redirect_uri?state=…&error=access_denied`. | `302` |
| `POST /_dev/reset` | Reset and seed (data-model.md). Then the browser goes back to `/_dev/`. Ends any session cookie. | `303 /_dev/` |
| `POST /_dev/events` (`athleteId`, `action`, …) | Simulates a Strava event (below) | `303 /_dev/` with the result in a flash query parameter |

### Simulated events (`POST /_dev/events`)

| `action` | Extra fields | Fake store change | Webhook body sent internally |
|---|---|---|---|
| `create` | `date`, `time`, `sportType`, `distanceKm`, `elevationM`, `movingMin`, `elapsedMin`, `private`, `manual` | Inserts the activity | `object_type: "activity"`, `aspect_type: "create"` |
| `update` | `activityId` and any of the `create` fields | Updates the activity | `aspect_type: "update"`, `updates` naming the changed fields (`private` → `{"private": "true"/"false"}`) |
| `delete` | `activityId` | Deletes the activity | `aspect_type: "delete"` |
| `deauthorize` | — | none | `object_type: "athlete"`, `updates: {"authorized": "false"}` |
| `repeat` | — | none | The last event sent, again (idempotency check) |

Every body carries `owner_id`, `object_id`, `event_time` (now) and
`subscription_id` from `STRAVA_SUBSCRIPTION_ID`. It is posted to
`/strava/webhook/<STRAVA_WEBHOOK_VERIFY_TOKEN>` through `handleFetch`, so it
passes the app's real checks.

## Response rewriting (all app responses)

A response whose `Location` starts with `https://www.strava.com/oauth/authorize` is
returned with `Location` replaced by `/_dev/strava/oauth/authorize` plus the same
query. Nothing else is changed.

## Automatic seeding

On the first request after start, the dev entry seeds unless `fake_strava_seed`
holds the fingerprint of the current sample data, the same way as
`POST /_dev/reset`. That request waits for it.

## Commands (`package.json`)

| Script | Runs |
|---|---|
| `pnpm dev` | Applies pending migrations to `.wrangler/fake-state` (non-interactive through `CI=1`), then, with the shell's declared secrets unset (`env -u …`), `wrangler dev dev/worker.ts --env-file dev/fake.env --var RYNKE_FAKE_STRAVA:local-only --persist-to .wrangler/fake-state --live-reload --test-scheduled` |
| `pnpm dev:strava` | `wrangler dev --test-scheduled`: the app against the real Strava with `.dev.vars` and `.wrangler/state`, as `pnpm dev` did before |

Both listen on `dev.port` 8789 from `wrangler.jsonc`, and `dev.host` keeps request
URLs on `localhost:8789`.
