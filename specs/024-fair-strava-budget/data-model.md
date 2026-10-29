# Data Model: Fair Share of the Strava Budget

Migration `0019_strava_work.sql`, additive only: the previously deployed
version ignores the new tables and column.

## `strava_work` — waiting Strava work (R1, R3)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | arrival order; FIFO per rider |
| `athlete_id` | INTEGER NOT NULL | → `riders` ON DELETE CASCADE |
| `message` | TEXT NOT NULL | `serializeWorkMessage` of the message; identifiers only |
| `kind` | TEXT NOT NULL | the message kind, for counting |
| `attempts` | INTEGER NOT NULL | the attempt the next run is, like a queue message's `attempts` |
| `not_before` | INTEGER NOT NULL DEFAULT 0 | epoch seconds; backoff after `transient` |
| `stored_at` | INTEGER NOT NULL | epoch seconds |

Index `strava_work_by_rider (athlete_id, id)`.

## `strava_queues` — one row per rider with waiting work (R2, R6, R7)

| Column | Type | Notes |
|---|---|---|
| `athlete_id` | INTEGER PRIMARY KEY | → `riders` ON DELETE CASCADE |
| `fresh` | INTEGER NOT NULL | 1 until first served |
| `turn` | INTEGER NOT NULL | position in the round; lower goes first |
| `events_total` | INTEGER NOT NULL DEFAULT 0 | activity events stored since the row began |
| `events_done` | INTEGER NOT NULL DEFAULT 0 | of those, finished |
| `show_progress` | INTEGER NOT NULL DEFAULT 0 | set at 10 waiting; stays |
| `start_training` | INTEGER | Training Rynke when the row began; NULL without a balance |
| `start_team` | INTEGER | Team Rynke when the row began |
| `held_badges` | TEXT NOT NULL DEFAULT '[]' | JSON array of the owner's badge ids earned while held |
| `created_at` | INTEGER NOT NULL | epoch seconds |

Index `strava_queues_by_turn (fresh DESC, turn)`.

The row is deleted when the rider's last `strava_work` row goes.

## `strava_held` — notifications owed after a backlog (R6)

| Column | Type | Notes |
|---|---|---|
| `owner_id` | INTEGER NOT NULL | the rider with the backlog → `riders` CASCADE |
| `recipient_id` | INTEGER NOT NULL | who gets the push → `riders` CASCADE |

Primary key `(owner_id, recipient_id)`: one push per recipient per backlog.

## `strava_turn` — the pending wake (R4)

Single row (`id = 1`), `wake_at INTEGER NOT NULL` (0 seeded): the time of the
last `strava-turn` message sent. A new one is sent only when `wake_at <= now`
or `wake_at` is later than the time needed.

## `riders.import_fetched` (R7)

`INTEGER NOT NULL DEFAULT 0`: activities listed by the current import so far.
Reset to 0 when `import_status` becomes `pending`, increased by each
`import-page`.

## Privacy (Principle I)

No new personal data: identifiers, counts, Rynke totals the rider already has
and badge ids. Everything goes with the rider (`ON DELETE CASCADE`).
