# Research: Fair Share of the Strava Budget

## R1. Where the fair order lives: a D1 table, not the queue

- **Decision**: Work that needs Strava (`activity-event` create/update,
  `import-page`, `reread-page`, `check-membership`) still arrives through the
  Cloudflare queue, but the consumer no longer works it off in arrival order. It
  stores each such message as a row of `strava_work` (one FIFO per rider, by
  row id), acks the queue message and then *drains*: it repeatedly picks the
  rider whose turn it is, runs their oldest row with the existing handler, and
  stops when the budget says so. Everything else (`delete-rider`,
  `evaluate-rider`, `send-notification`, `activity-event` delete) runs as today,
  straight from the queue.
- **Rationale**: Cloudflare Queues deliver in roughly arrival order and offer no
  way to reorder or peek. A fair order on top of it would mean bouncing every
  message that isn't its rider's turn back into the queue, again and again: a
  300-event backlog would cost thousands of queue operations a day, against the
  free tier's daily allowance (Principle IV). Today's budget deferral already
  bounces every waiting message once per window. A table costs a few D1 writes
  per item, holds no activity data (only the message's identifiers, as
  `failed_work` does), and makes the turn a single indexed query.
- **Alternatives considered**: Re-sending messages that aren't their rider's
  turn; rejected for the queue operations above and because the order would
  still depend on delivery timing. A Durable Object as scheduler; rejected: a
  new paid-plan-only primitive for one small queue, against Principle IV. One
  Cloudflare queue per rider; rejected: queues are created by configuration, not
  at run time.

## R2. The turn rule

- **Decision**: `strava_queues` has one row per rider with waiting work:
  `fresh` (1 while the rider has not been served since their queue was empty)
  and `turn`, a number from one ascending sequence (`MAX(turn) + 1` at the time).
  A new row gets `fresh = 1` and the next number; serving a rider sets
  `fresh = 0` and the next number, which puts them at the back. The next item
  is the oldest row of the rider first in `ORDER BY fresh DESC, turn ASC` whose
  oldest row is ready (`not_before <= now`). The row is deleted when the rider's
  last item is done, so their next work makes them fresh again.
- **Rationale**: That is round robin with FIFO per rider (clarification 2) and
  the next turn for a rider whose queue was empty (FR-002a, clarification 3);
  fresh riders among themselves keep their arrival order. New work for a rider
  who already has a row only appends to `strava_work` and leaves `fresh` and
  `turn` alone (FR-002b). Only the consumer writes either table and it runs one
  invocation at a time (`max_concurrency: 1`), so the sequence needs no lock.
- **Alternatives considered**: Last-served timestamps; rejected, ties within one
  second are common when a batch is drained.

## R3. Retries, deferral and failure inside the table

- **Decision**: A row carries `attempts` (deliveries used, starting from the
  queue message's own `attempts` when stored) and `not_before`. The results
  `ok`, `transient`, `budget` and `refresh-refused` keep their meaning
  (contracts/queue-messages.md of feature 001):
  - `ok`: the row goes, a matching `failed_work` row goes too.
  - `transient`: `attempts + 1`, `not_before = now + backoffSeconds(attempts)`;
    on the last attempt (`MAX_ATTEMPTS`) the message goes to `failed_work`, is
    logged with the same line as today ("moved to failed_work") and the row is
    deleted. A rider whose head row waits for its backoff is skipped, others go
    on.
  - `budget`: nothing changes on the row and the drain stops (FR-009); it is
    woken again when the window or day turns (R4).
  - `refresh-refused`: the rider is marked `needs_reconnect` and all their rows,
    their `strava_queues` row and their held notifications go (FR-010).
- **Rationale**: The same rules as today, so a message that runs out of retries
  ends up exactly as before. Waiting for the budget costs no attempt.
- **Consequence for tests**: queue-level tests of those kinds that expect
  `message.retry()` or a re-send on `budget` now expect an ack, a row with its
  backoff, or a `strava-turn` wake.
- **Consequence for fake mode** (feature 006): Ida Importing's stuck import was
  a fake `429` on her activity list. A `429` stops the whole drain, as Strava's
  limits are per app, so it held back every sample rider behind her. Her fake
  now answers `503`: her import backs off alone and stays `pending`.

## R4. Waking the drain

- **Decision**: Every consumer invocation drains after storing its batch. When
  the drain stops with work left, it asks to be woken: on `budget` at the
  handler's `delaySeconds`, when only backing-off rows are left at the earliest
  `not_before`, and after `DRAIN_LIMIT` (50) items in one invocation at once.
  The wake is a queue message `{ "kind": "strava-turn" }` with that delay,
  capped at 12 hours like every delay. A single-row table `strava_turn` keeps the
  time of the last wake asked for; a new wake is only sent if none is pending at
  or before the time needed, so a burst of webhook events costs one wake.
- **Rationale**: Webhook bursts trigger drains anyway; the wake only covers the
  quiet case (nothing arrives while the budget recovers). The daily cron's
  fan-out messages drain too, a safety net if a wake was ever lost.
- **Alternatives considered**: Cron only; rejected, it runs once a day.

## R5. Reserve for sign-ins and token calls

- **Decision**: `budgetDecision` takes a priority. `interactive` keeps today's
  stopping points (10 short of the 15-minute limits, 50 short of the daily
  ones). `background` stops another 10 earlier per window and another 50
  earlier per day, i.e. at 80 of 100 reads per 15 minutes and 900 of 1,000 a
  day at the default limits (assumption in the spec: about 10 per window). The
  Strava client's calls are `background` unless the caller says otherwise; the
  sign-in callback's club check, the token exchange and every revocation are
  `interactive`; a token refresh takes the priority of the call it serves.
  The OAuth token and revoke endpoints are now budget-checked too (FR-007), and
  their usage headers are recorded like every other response's.
- **Rationale**: Sign-in, reconnect and deletion are what a person waits for on
  a page. A sign-in takes 2–4 requests; 10 per window covers a team evening.
  The overall stopping points (FR-001, SC-003) don't move. A revoke refused for
  budget is reported as `transient`, so a deletion retries rather than skipping
  the revoke (delete-rider still deletes on its last attempt, as today).
- **Alternatives considered**: Exempting interactive calls from the budget;
  rejected by FR-007 and Principle II. Counting a token call Strava doesn't
  report as one request; rejected: it would be a guess written into the shared
  budget (the fake Strava sends no headers either), and the margins already
  cover a few unreported calls.

## R6. One notification after a backlog

- **Decision**: While draining, handlers get a context whose queue holds back
  `send-notification` messages. After each item:
  - If the rider still has rows waiting, the riders those messages were for are
    stored in `strava_held` (owner, recipient). If the owner is among them, the
    badges this item earned (read from `badge_rises` before and after) are
    added to `strava_queues.held_badges`.
  - If the rider's queue is now empty and nothing was held for them, the
    messages are sent as they are: a lone event notifies exactly as today
    (FR-017).
  - If the queue is empty and something was held, the owner's rise is written
    once for the whole backlog: the balance now minus the balance stored when
    the backlog began (`start_training`, `start_team`), and the badge rise as
    all `held_badges`. The owner is notified if either is non-empty; every
    other held recipient is notified once (`notifyRiders`), and the held rows
    go.
- **Rationale**: The device fetches the text from `/me/notification-text`,
  which reads the stored rise, which normally holds only the last change
  ("replaces the one before"). Writing the whole backlog's rise at the end is
  what makes the one notification tell all of it (FR-015). Team badge rises of
  other riders are already stored by `teamBadgeNews`; only their push waits
  (FR-016). A disconnected or deleted rider's rows go by `ON DELETE CASCADE`,
  so nothing is released for them.
- **Known limit**: a rider who receives two team badges from someone else's
  backlog sees the text of the later one (badge rises replace each other for
  riders other than the one whose change it was, feature 013 R17). The count
  of notifications is still one.

## R7. The progress line

- **Decision**: `strava_queues` counts `events_total` (activity events stored
  since the row was created) and `events_done` (those finished, whatever the
  outcome). `show_progress` is set once `events_total - events_done` reaches
  10 when an event is stored, and stays until the row goes (FR-018). The
  import's count is a new `riders.import_fetched`, reset when an import is set
  `pending` and increased by each page's listed activities; the import line
  shows while `import_status = 'running'`, which is set after a full first page,
  i.e. once the first points exist (FR-019). If both apply, the import line
  wins. `GET /me/fetching` answers `{ "text": string | null }` in the request's
  language, from one D1 read and no Strava request; the page script polls it at
  `READY_POLL_SECONDS` while the line is shown and reloads the page content
  (`refreshPage`) when it answers `null`, so the new rides appear (FR-020).
- **Rationale**: The import's next page goes back through the queue, so the
  rider's `strava_queues` row may briefly be gone between pages; a counter on
  the rider survives that. The text comes from the server so `app.js` keeps
  holding no text.

## R8. What stays as it is

- The webhook only enqueues (Principle II); it is unchanged.
- `delete-rider` never waits for the table (FR-010); `evaluate-rider` and
  `send-notification` need no Strava call (FR-011). An `activity-event` with
  `aspect = delete` runs at once too: whatever order it meets a waiting create
  in, every path converges to Strava's current state (feature 001 FR-017).
- Handlers are unchanged except `import-page` (counts `import_fetched`); their
  follow-up messages (the next page, a `delete-rider`) go through the queue as
  today.
