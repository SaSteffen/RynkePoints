# Data Model: Strava Connection and Webhook Activity Intake

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Storage is a single D1 database (EU jurisdiction, R11). The schema is created by
migration `migrations/0001_init.sql` and extended by
`migrations/0002_activity_points_figures.sql`,
`migrations/0003_activity_flagged.sql` and
`migrations/0004_consent_and_write_scope.sql`. D1 enforces foreign keys, so every
rider-owned row uses `ON DELETE CASCADE`: deleting a `riders` row is the complete
deletion required by FR-022.

Timestamps are Unix epoch seconds (`INTEGER`) unless noted.

## riders

One row per connected member of the team club.

| Column | Type | Rules |
|---|---|---|
| `athlete_id` | INTEGER PK | Strava athlete ID. |
| `first_name` | TEXT NOT NULL | From the token response's `athlete.firstname`; greeting only. |
| `status` | TEXT NOT NULL | `connected` \| `needs_reconnect`. |
| `scope_read_all` | INTEGER NOT NULL | 1 if `activity:read_all` was granted, else 0. |
| `scope_write` | INTEGER NOT NULL DEFAULT 0 | 1 if `activity:write` was granted, else 0 (FR-003, FR-025). Nothing in this feature writes; the description feature will only write for riders with 1. Added by `0004`; riders connected before it never were asked and keep 0. |
| `scopes` | TEXT NOT NULL | Accepted scope string as returned by Strava (FR-006). |
| `connected_at` | INTEGER NOT NULL | First connection. |
| `scopes_updated_at` | INTEGER NOT NULL | When the rider last chose their scopes: first connect or a changed grant; signing in with the same scopes keeps it (FR-006). |
| `membership_checked_at` | INTEGER NOT NULL | Last definitive "is a member" answer. |
| `import_status` | TEXT NOT NULL | `pending` \| `running` \| `done`. |
| `reconnect_requested_at` | INTEGER NULL | When the rider became `needs_reconnect`; `NULL` exactly when `status=connected` (CHECK). Riders more than 7 days past it are deleted (FR-020). |
| `figures_version` | INTEGER NOT NULL DEFAULT 0 | ≥ 0. Version of the FR-013 field set the rider's activities were last read with (R20). New riders get the current `ACTIVITY_FIGURES_VERSION`; a lower value makes the daily cron re-read them once. Added by `0002`; the current version is 2 (`0003` added `is_flagged`). |

Not stored, by design: last name, profile photo, city, gender, weight, email
(Principle I), and the rider's language. The language is a per-browser preference
held only in the `rp_lang` cookie (FR-029a, see below).

### Rider lifecycle

```text
               callback ok + member
 (none) ───────────────────────────────► connected ◄─────────────┐
   ▲                                       │    │                │ reconnect
   │ deauth event / disconnect /           │    │ refresh        │ (callback ok)
   │ left club / non-member at connect     │    │ refused        │
   └───────────────────────────────────────┘    ▼                │
          (hard delete, cascades)          needs_reconnect ──────┘
                                                │
                                                └─► deleted on deauth / disconnect /
                                                    7 days without reconnecting
```

- `needs_reconnect`: no Strava calls are made for this rider, except revoking
  their token on deletion. Pending messages are acked and dropped. The daily
  membership check skips them (their token is unusable). `/me` asks them to
  reconnect. The daily cron deletes them once `reconnect_requested_at` is more
  than 7 days ago (FR-020), so a revocation Strava never notified us about can't
  keep data indefinitely.
- Reconnect (FR-007, FR-020): update `scopes`, `scope_read_all`, `scope_write`,
  `status=connected`, `reconnect_requested_at=NULL` and the credentials. If the
  rider came through the consent form, record their consent (see
  `consent_records`).
  - If `scope_read_all` went 1 → 0: `DELETE FROM activities WHERE athlete_id=? AND
    is_private=1`.
  - If it went 0 → 1, or the rider was `needs_reconnect`: set
    `import_status=pending` and enqueue the import (R8), so activities uploaded
    while the connection was broken are picked up.
  - A change of `scope_write` alone triggers neither.
- Signing in again without activity-read permission, or as a definitive
  non-member, deletes the rider (contracts/http-routes.md, callback table).

### Import status

`pending` (enqueued) → `running` (first page processed) → `done` (last page was
short). A reconnect that newly grants `read_all`, or that ends
`needs_reconnect`, resets it to `pending`.

## strava_credentials

Exactly one per rider (FR-027).

| Column | Type | Rules |
|---|---|---|
| `athlete_id` | INTEGER PK, FK → riders ON DELETE CASCADE | |
| `access_token_enc` | TEXT NOT NULL | `v1:<iv>:<ciphertext>` AES-256-GCM (R10). |
| `refresh_token_enc` | TEXT NOT NULL | Same format; replaced on every rotation. |
| `expires_at` | INTEGER NOT NULL | Access-token expiry from Strava. |

## activities

One row per stored cycling activity (FR-013–FR-016).

| Column | Type | Rules |
|---|---|---|
| `strava_activity_id` | INTEGER PK | |
| `athlete_id` | INTEGER NOT NULL, FK → riders ON DELETE CASCADE | Indexed with `start_date DESC` for `/me`. |
| `sport_type` | TEXT NOT NULL | Must be in the cycling set (R5); otherwise the row is deleted, never written. |
| `start_date` | TEXT NOT NULL | ISO-8601 UTC as returned by Strava. |
| `start_date_local` | TEXT NOT NULL | ISO-8601 local wall-clock time. |
| `timezone` | TEXT NOT NULL | Strava's timezone string, e.g. `(GMT+01:00) Europe/Berlin`. |
| `distance_m` | REAL NOT NULL | ≥ 0. |
| `moving_time_s` | INTEGER NOT NULL | ≥ 0. |
| `elapsed_time_s` | INTEGER NULL | ≥ 0. Start to finish, including pauses (Strava's `elapsed_time`). `NULL` = unknown (see below). |
| `elevation_gain_m` | REAL NOT NULL | ≥ 0. |
| `is_manual` | INTEGER NULL | 1 if entered manually (Strava's `manual`), else 0. `NULL` = unknown. |
| `is_trainer` | INTEGER NULL | 1 if ridden on an indoor trainer (Strava's `trainer`), else 0. `NULL` = unknown. |
| `is_flagged` | INTEGER NULL | 1 if Strava has flagged the activity (Strava's `flagged`), else 0. `NULL` = unknown. Added by `0003`. |
| `is_private` | INTEGER NOT NULL | 1 if "Only You". Needed to honour scope narrowing (FR-007); later team-visible features will also need it to keep "Only You" rides out of anything others see. |
| `refreshed_at` | INTEGER NOT NULL | Last time the row was written from Strava data. |

Every write is an upsert keyed by `strava_activity_id` (R5). No GPS, polyline,
coordinates, title, description, photos, heart rate or power (FR-014). The
mapping from Strava's response is an explicit allow-list, so unknown fields can't
leak in.

`elapsed_time_s`, `is_manual` and `is_trainer` were added later by migration
`0002_activity_points_figures.sql`, and `is_flagged` by
`0003_activity_flagged.sql`, for feature 003-rynke-evaluation (FR-005a, FR-005b,
FR-013a and FR-005g there). They are nullable because the spec records a figure
missing from a row as unknown, never as a guessed 0, "not manual", "not on a
trainer" or "not flagged" (spec edge case "Activities stored before a figure was
added"). Every write sets all four from Strava's response; a field absent from
the response is stored as `NULL`.

Strava sends no event when it flags an activity, so `is_flagged` follows the
next time the activity is read: an update event that changes more than the
title, the import after a reconnect, or a re-read (spec edge case "Strava flags
a stored activity later"). It is never polled for.

Rows stored before `0002` (or `0003`) start with `NULL` figures. The daily cron
re-reads the season of every rider whose `figures_version` is behind (R20,
contracts/queue-messages.md `reread-page`). That fills the rows, or deletes the
ones Strava no longer returns as the rider's cycling activities. Until then the
figures stay unknown. Feature 003 must treat `NULL` as unknown, never as 0.

## consent_records

The consent a rider accepted (feature 004-roles-and-consent, FR-013; research
R21). Added by `0004`.

| Column | Type | Rules |
|---|---|---|
| `athlete_id` | INTEGER NOT NULL, FK → riders ON DELETE CASCADE | |
| `version` | INTEGER NOT NULL | ≥ 1. The `CONSENT_VERSION` the rider ticked on the landing page. |
| `accepted_at` | INTEGER NOT NULL | When the callback stored it. |

Primary key `(athlete_id, version)`. Writes are `INSERT OR IGNORE`, so ticking the
same version again on a later sign-in keeps the first acceptance. The row with the
highest `version` is the rider's current consent, shown on `/me` (FR-025).

- A new rider is inserted together with their record in one D1 batch; a new
  athlete without an agreed version is never stored (contracts/http-routes.md).
- Riders connected before `0004` have no record. They get one the next time
  they connect through the landing page; until then `/me` says none is recorded,
  and feature 004 leaves them out of every shared view (its FR-021).
- Deleted with the rider by the cascade (FR-022); no deletion path needs a change.

The consent version itself is code, not data: `CONSENT_VERSION` in
`src/consent.ts`, with its text in the catalogs (`consent.*`, contracts/messages.md).

## failed_work

Queue messages that exhausted their retries on transient errors (R7, FR-019).
A row stays until its message succeeds, it is given up, or its rider is deleted,
so organisers can see every open failure.

| Column | Type | Rules |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `athlete_id` | INTEGER NOT NULL, FK → riders ON DELETE CASCADE | |
| `message` | TEXT NOT NULL UNIQUE | Canonical JSON of the queue message (`serializeWorkMessage`, identifiers only). Writes are upserts on this column. |
| `last_error` | TEXT NOT NULL | Status code / short reason; never tokens. |
| `first_failed_at` | INTEGER NOT NULL | Set on the first failure, kept on later ones. Rows more than 7 days past it are given up (deleted and logged) by the daily cron. |
| `failed_at` | INTEGER NOT NULL | Latest failure. |
| `failures` | INTEGER NOT NULL | ≥ 1. How many times the message exhausted its queue retries. |

## strava_rate_limit

Single row (`id = 1`) holding the app-wide Strava budget (R6).

| Column | Type | Rules |
|---|---|---|
| `id` | INTEGER PK CHECK (id = 1) | |
| `observed_at` | INTEGER NOT NULL | Time of the response the usage was read from. |
| `read_15m`, `read_daily` | INTEGER NOT NULL | From `X-ReadRateLimit-Usage`. |
| `all_15m`, `all_daily` | INTEGER NOT NULL | From `X-RateLimit-Usage`. |
| `limit_read_15m`, `limit_read_daily`, `limit_all_15m`, `limit_all_daily` | INTEGER NOT NULL | From the `*-Limit` headers; seeded with 100/1000/200/2000. |

The usage counts only apply while `observed_at` is in the current 15-minute window
or UTC day. Otherwise they are treated as 0.

## Team settings (configuration, not tables)

Set in `wrangler.jsonc` `vars` (FR-021a). Changing them is a deploy, not a code
change.

| Name | Example | Meaning |
|---|---|---|
| `STRAVA_CLUB_ID` | `"2372209"` | Team club ("TRHH Rynke Coins"). |
| `SEASON_START_DATE` | `"2026-01-01"` | Import cutoff, interpreted as 00:00 Europe/Berlin. |
| `STRAVA_SUBSCRIPTION_ID` | `"0"` until created | Events with another `subscription_id` are dropped. |

## Language preference (cookie, not stored)

The language a visitor picked with the switcher lives only in their browser
(FR-029a, research R17/R18). It's not a table and not a `riders` column.

| Cookie | Value | Attributes | Rules |
|---|---|---|---|
| `rp_lang` | A locale key of the catalog registry (`de`, `en`) | `Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly` | Set only by `POST /lang`. An unknown value is ignored on read, so resolution falls through to `Accept-Language` and then `de`. Unsigned; carries no rider identity. |

Resolution order: valid `rp_lang` → best supported `Accept-Language` range → `en`
if the header names only unsupported languages → `de`.

## Message catalogs (code, not tables)

Rider-facing text is code in `src/i18n/messages/<locale>.ts`, not data. The
inventory of message IDs with German and English text is in
[contracts/messages.md](contracts/messages.md).

- `de` is the source catalog. It defines `MessageId`, and it is the language when
  the browser states no preference (research R17).
- Every other catalog has exactly the same keys (enforced by `tsc` and a parity
  test), no empty values, and the same `{placeholder}` set per message.
- `meta.languageName` must be unique across catalogs, because it labels the
  switcher.
- The registry `src/i18n/catalogs.ts` lists the shipped locales: `de`, `en`.

## Queue message (`Pending Activity Work`)

See [contracts/queue-messages.md](contracts/queue-messages.md). Messages carry only
numeric IDs and enum values, never activity data or tokens.
