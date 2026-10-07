# Data Model: Installable App and Notifications for New Rynke

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

One table is added. Every other table is unchanged; the full schema is in 001's
[data-model.md](../001-strava-connect-webhook/data-model.md) and 003's for the
Rynke tables.

## `push_subscriptions` (new): the spec's "notification registration"

| Column | Type | Null | Meaning |
|---|---|---|---|
| `subscription_id` | `INTEGER PRIMARY KEY` | no | Row ID. Used in queue messages instead of the endpoint. |
| `endpoint` | `TEXT UNIQUE` | no | The push-service URL the browser gave this device (research R7). |
| `athlete_id` | `INTEGER` | no | The rider the device belongs to. References `riders`, `ON DELETE CASCADE`. |
| `created_at` | `INTEGER` | no | Epoch seconds when the rider last turned notifications on here. |

Migration `migrations/0008_push_subscriptions.sql`:

```sql
-- Devices on which a rider turned on notifications for new Rynke (feature
-- 010-pwa-notifications, FR-010 to FR-021). See
-- specs/010-pwa-notifications/data-model.md and research R7.
--
-- Pushes carry no data, so a device needs nothing but its endpoint: no
-- encryption keys, language or device details. Deleting a rider removes their
-- devices (FR-013). Only adds a table, so the previously deployed version keeps
-- working.

CREATE TABLE push_subscriptions (
	subscription_id INTEGER PRIMARY KEY,
	endpoint TEXT NOT NULL UNIQUE
		CHECK (endpoint LIKE 'https://%' AND length(endpoint) <= 1024),
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	created_at INTEGER NOT NULL
);

CREATE INDEX push_subscriptions_by_rider ON push_subscriptions (athlete_id);
```

**Validation** (`src/http/notifications.ts`, before any write):
- the endpoint parses as a URL;
- its protocol is `https:` and it has no credentials;
- its host is in the allow-list of research R7;
- it is at most 1024 characters long.

Anything else gets a 400, and nothing is written.

**Lifecycle**:

| Event | Effect |
|---|---|
| Rider turns notifications on (`action=on`) | Upsert on `endpoint`: insert, or set `athlete_id` and `created_at` (the device may move to another rider, spec edge case). Then, if the rider has more than 10 rows, delete their oldest. |
| Rider turns them off (`action=off`) | Delete the row with this endpoint **and** the session's rider. |
| Rider signs out with the endpoint sent along (research R9) | Same delete as turning off. |
| Push service answers 404 or 410, or the stored host is no longer allowed | Delete the row (FR-021). |
| Rider leaves, deauthorizes or is removed (001 FR-022, FR-023; 004 FR-015) | Cascade from `riders` (FR-013, SC-005). |
| Sign-in ends by itself (FR-007) | Nothing (FR-013). |

**Who reads it**:
- `POST /me/notifications` with `action=check`, for the session's rider and
  one endpoint;
- the rise handling, for one rider's subscription IDs;
- the `send-notification` handler, for one ID and rider.

Nothing displays it, and nothing joins it to activities.

**Statements** (`src/db/push-subscriptions.ts`): `upsertSubscription`,
`trimSubscriptions` (keeps the newest 10 of a rider),
`deleteSubscription(endpoint, athleteId)`, `deleteSubscriptionById`,
`hasSubscription(endpoint, athleteId)`, `subscriptionIdsOfRider` and
`subscriptionEndpoint(id, athleteId)`.

## Not stored

- **The notification language**: it lives on the device, in the service
  worker's URL and cache (research R2). The rider record and this table don't
  hold it (FR-031).
- **Sent notifications**: not needed. A replayed change leaves the rider's
  totals as they were, so it raises nothing (research R5). The spec lists this
  entity as optional.
- **The install-hint dismissal**: device-local `localStorage` only (research
  R11).

## Session cookie (feature 001, research R9): new lifetime

There is no schema change. `rp_session` keeps its format
(`<athleteId>.<expiresAt>.<signature>`), its attributes and its signing key.
`SESSION_MAX_AGE` goes from 30 days to 180 days (15 552 000 s). A GET or HEAD
page view with a valid cookie whose expiry is more than a day older than a
fresh one gets a new cookie (research R10).

## Types in code

- **`SendNotificationMessage`** (`src/work/messages.ts`):
  `{ kind: "send-notification"; athleteId: number; subscriptionId: number }`.
  Both fields are validated with `isId`.
- **`applyAndEvaluate`** returns `{ rose: boolean }`.
- **`applyTeamEventChange`** returns `{ eventId, affected, rose: number[] }`.
- **`PushOutcome`** (`src/push/send.ts`): `"sent" | "gone" | "transient" |
  "refused"`.

## Configuration

| Name | Kind | Where | Meaning |
|---|---|---|---|
| `PUSH_VAPID_KEY` | secret (required) | Cloudflare secret, `.dev.vars`, `dev/fake.env` (synthetic), `vitest.config.ts` (synthetic) | EC P-256 private key as JWK JSON (research R4). |
| `PUSH_SUBJECT` | var | `wrangler.jsonc` | The VAPID `sub` contact: `https://trhh-rynke-coins.link`. |
