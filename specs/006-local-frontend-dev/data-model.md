# Data Model: Local Frontend Development with a Fake Strava

Everything here exists only in fake mode: in `dev/` code and in the fake mode's
local database `.wrangler/fake-state`. The app's own schema (`migrations/`) is
unchanged. All values are synthetic (constitution Principle I).

## Sample rider (code: `dev/fake-strava/samples.ts`)

| Field | Meaning |
|---|---|
| `athleteId` | Synthetic Strava athlete ID, 990001–990099. That range is used by neither the tests (900001…) nor real riders. |
| `firstName` | Names the state, e.g. `Tina TrainingDone`, `Ida Importing`. The pages show it as the rider's name. |
| `scopes` | The scopes it connects with when seeded. The stand-in screen preselects them, and the developer can change them there. |
| `clubMember` | Whether `GET /athlete/clubs` lists `STRAVA_CLUB_ID` |
| `behaviour` | `normal`, `import-stuck` (activity list answers `429`) or `refused` (activity endpoints answer `401`, refresh `400`; sign-in still works) |
| `rides` | A ride recipe: a list of synthetic rides relative to seeding day (below) |

The list (research R6): Ida Importing, Nora NoRides, Fiona FarAway, Tina
TrainingDone, Vera Virtual, Rex Rejected, Paula Paging, Olli OptionalDenied, Remy
Reconnect, Noah NotMember. Each rider is connected at seeding except Noah
NotMember, whose sign-in is refused by design.

## Ride recipe entry

| Field | Meaning |
|---|---|
| `daysAgo` | Start day relative to seeding day, the Europe/Berlin day of the app's clock (`ctx.now()`) when seeding runs. Entries before the season start are moved to the season start. |
| `startTime` | Local wall-clock time (`HH:MM`, Europe/Berlin) |
| `sportType` | Strava `sport_type`, e.g. `Ride`, `VirtualRide`, `EBikeRide`, `Run` |
| `distanceKm`, `elevationM` | Distance and elevation gain |
| `movingMin`, `elapsedMin` | Moving and elapsed time; `elapsedMin` can be left out to give an "unknown" figure |
| `manual`, `trainer`, `flagged`, `private` | Strava's flags, default `false` |

Recipes are deterministic, so a reset always gives the same balances for the same
seeding day. Whether a ride counts follows from the app's rules, never from the
recipe: the recipe only picks figures that are known to fall on one side of a rule.

## Fake activity (table `fake_strava_activities`)

Created by the dev entry with `CREATE TABLE IF NOT EXISTS`, in fake mode's local
database only. It is never a migration.

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER PK | Synthetic Strava activity ID: 8_000_000 + sequence. Seeding renumbers from 8_000_001. |
| `athlete_id` | INTEGER | Owner (a sample rider's `athleteId`) |
| `body` | TEXT (JSON) | The activity as Strava's `DetailedActivity` would send it, limited to the fields the app reads (`id`, `sport_type`, `start_date`, `start_date_local`, `timezone`, `distance`, `moving_time`, `elapsed_time`, `total_elevation_gain`, `manual`, `trainer`, `flagged`, `private`) plus a synthetic `name`. No GPS, polyline, heart rate or power. |

Writers: seeding (from recipes) and simulated events (insert, update, delete).
Readers: the fake's activity list and single-activity answers.

## Stateless OAuth values (`dev/fake-strava/tokens.ts`)

| Value | Format | Checked by the fake |
|---|---|---|
| Authorization code | `fake-code.<athleteId>.<scopes>` | The athlete is a sample rider. Codes can be reused; nothing is remembered. |
| Access token | `fake-access.<athleteId>.<scopes>.<expiresAt>` | Not expired. The activity endpoints refuse a `refused` rider anyway |
| Refresh token | `fake-refresh.<athleteId>.<scopes>` | The athlete's behaviour isn't `refused` |

`<scopes>` is the comma-separated scope list, URL-encoded. Access tokens last 6
hours, like Strava's. The `scopes` decide whether private activities are visible
(`activity:read_all`).

## Fake mode settings (`dev/fake.env`, committed)

| Name | Value |
|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Fixed placeholders. The fake checks them like Strava does. |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Fixed placeholder, used for the internal webhook calls |
| `TOKEN_ENCRYPTION_KEY`, `SESSION_SIGNING_KEY` | Fixed synthetic 32-byte keys, base64 |
| `RYNKE_FAKE_STRAVA` | `local-only`, the marker the dev entry requires (research R9) |

`STRAVA_CLUB_ID`, `SEASON_START_DATE` and `STRAVA_SUBSCRIPTION_ID` come from
`wrangler.jsonc` as usual.

## App rows produced by seeding

None of these are written directly: they come from the app's own flow. The app
stores a rider row, encrypted credentials and a consent record per connected
sample rider (feature 001, 004). It stores activities and ride results through
the import and evaluation (feature 003), and a balance per evaluated rider. Reset
deletes `riders` (everything rider-owned cascades) and resets the
`strava_rate_limit` row to its migration values before seeding again.
