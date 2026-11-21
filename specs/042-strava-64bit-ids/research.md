# Research: Strava 64-bit IDs

## R1 — What Strava sends (checked 2026-11-21)

**Decision**: Read `id_str` where it is a valid ID, else the exact digits of `id`. Webhook
`object_id` and `owner_id` are read from their exact digits.

**Findings** (Strava's published API schema, `developers.strava.com/swagger/*.json`, and the
changelog):

- `SummaryActivity` (so also `DetailedActivity`) has `id_str` (string) next to `id` (int64).
- `MetaAthlete` has `id_str`; `SummaryAthlete` and `DetailedAthlete` inherit it, so the athlete in
  the token answer and the athlete nested in an activity carry it.
- The schema's examples don't all show it yet: the athlete nested in an activity has `id` only.
- Webhook events: `object_id` and `owner_id` are "long integer"; no string variant. Same for
  `subscription_id`.
- Changelog 2026-11-13: "Add `id_str` to Activities and Athletes in case your app cannot handle
  64-bit integers."

**Rationale**: `id_str` is what Strava recommends. The fallback to the exact digits of `id` makes
the app independent of whether every response carries `id_str` yet, and the webhook needs the
exact-digits reading anyway. With both, no live request is needed for correctness.

**Alternatives considered**:

- `id_str` only: breaks on any response without it (nested athletes in the examples, older
  cached answers).
- Exact digits of `id` only: correct as well, but ignores Strava's recommendation for no saving;
  the fallback costs one line.
- A test request against the real Strava before building: not needed for correctness (above). The
  maintainer can confirm `id_str` with one read-only request at any time; it isn't part of the
  build or the tests (CLAUDE.md: no real Strava calls from tests).

## R2 — Reading exact digits from JSON

**Decision**: `JSON.parse` with a reviver that uses the reviver's third argument (`context.source`,
the value's source text). For the ID keys, the reviver returns the source text when the value is a
number.

**Rationale**: It is part of the platform (TC39 "JSON.parse source text access", in V8 since 11.4).
Probed in the Workers runtime used by the tests (`compatibility_date` 2026-08-22): for
`{"object_id": 9223372036854775807}` the reviver gets `source` `"9223372036854775807"`. Node 24
(the scripts) has it too. No dependency is needed.

**Alternatives considered**: a lossless JSON library (`json-bigint`, `lossless-json`): a
dependency for what the platform does; a regular expression over the body: fragile with nested
objects and titles that contain digits.

## R3 — Writing exact digits into JSON

**Decision**: `JSON.rawJSON(id)` where an ID must be a JSON number: the fake Strava's answers and
events, the `held` exchange between a team and the gateway, and arrays bound for SQLite's
`json_each`.

**Rationale**: Same platform proposal; probed: `JSON.stringify({ id: JSON.rawJSON("9223372036854775807") })`
gives `{"id":9223372036854775807}`. Keeping the `held` body a number keeps it compatible with the
gateway and teams of the previous version during a deployment (they are deployed by separate
jobs). For `json_each`, numbers make `value` an integer, so `athlete_id IN (SELECT value FROM
json_each(?))` compares integers with integers.

**Alternatives considered**: strings in the `held` body: an old gateway or team refuses them
(`Number.isSafeInteger`) until both are deployed. Strings in `json_each` arrays: `value` is then
text, and comparing it with an `INTEGER` column relies on affinity rules for a virtual table
column; numbers avoid the question.

## R4 — The IDs inside the app

**Decision**: Activity and athlete IDs are decimal strings everywhere in the app: types, queue
messages, rows, sessions, links. One module, `src/strava/id.ts`, owns validation, the legacy
conversion from numbers, numeric comparison, and the JSON reading and writing of R2 and R3.

**Rationale**: A JavaScript number can't hold them; `BigInt` can't be bound to D1 (probed:
`D1_TYPE_ERROR: Type 'bigint' not supported`), isn't JSON-serialisable and can't go into
templates without conversions everywhere. Strings pass through D1, JSON, cookies, URLs and HTML
unchanged. The type checker finds every place that did arithmetic or compared with numbers.

A valid ID matches `^[1-9][0-9]{0,18}$` and is at most 2^63 − 1 (what SQLite's `INTEGER` holds).
Numeric order: shorter first, then by text (valid IDs have no leading zeros).

**Alternatives considered**: `bigint`: see above. A branded string type: no gain over the type
checker's number/string distinction for this change, more noise in every test.

## R5 — D1

**Decision**: The columns stay `INTEGER`; no migration. IDs are bound as text; every `SELECT` that
returns an ID column returns `CAST(<column> AS TEXT) AS <name>`.

**Findings** (probed in Miniflare's D1): binding `"9007199254740993"` into an `INTEGER PRIMARY KEY`
and an `INTEGER` column stores an integer (`typeof` = `integer`). `WHERE id = ?1` bound with the
same text finds the row. A plain `SELECT id` returns `9007199254740992` (rounded);
`CAST(id AS TEXT)` returns `"9007199254740993"`. SQLite applies the column's `INTEGER` affinity to
a bound text value in comparisons and inserts, so existing rows and the previous version are
unaffected.

**Rationale**: No migration (FR-007 trivially holds), no change to what the previous version
reads, and sorting, joins and indexes in SQL stay numeric.

**Alternatives considered**: new `TEXT` columns beside the `INTEGER` ones: a migration per table
with a copy, two sources of truth during the switch, and text ordering in SQL.

**Safety net**: the test setup wraps D1 so that any result row with a number in an ID column
(`athlete_id`, `strava_activity_id`, `overlaps_activity_id`, or `athleteId`/`activityId` aliases)
fails the test. A missed `CAST` shows up in whichever test reads that query, with small IDs too.

## R6 — Previous version's data

**Decision**: Queue messages, parked Strava work and failed work written by the previous version
carry IDs as numbers; the message parser accepts a positive safe integer and turns it into the
string. New messages carry strings. Sessions already hold the ID as text in the cookie; they are
read as a string. No data is rewritten.

## R7 — Fake Strava and samples

**Decision**: The fake Strava keeps IDs as strings and writes them like Strava: `id` as a JSON
number (R3) plus `id_str` on activities and athletes, numbers only in webhook events. Some sample
riders of each team, and the activities of one rider, get large IDs. Test fixtures keep their
small IDs (as strings) and some tests gain large-ID cases; the D1 safety net (R5) covers every
query with small IDs already.

**Rationale**: Small IDs in most fixtures keep the test diff mechanical; the large-ID tests cover
the boundary paths (webhook, gateway, token exchange, list and detail answers, queue, session,
D1, ordering).

## R8 — Ordering in code

**Decision**: Sorts and tie-breaks that used `a - b` on IDs use `compareIds`. `Set`, `Map` and
`===` work on strings as they did on numbers.

## R9 — Consent

**Decision**: No new consent version. `id_str` is the same value as `id`, which the app already
reads and stores (constitution Principle I: no new scope, no new kind of request, no new data).
