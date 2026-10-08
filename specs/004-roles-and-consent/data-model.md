# Data Model: Roles and Rider Consent (User Stories 1–4)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

One migration, `0009_organiser_flag.sql`, adds the organiser flag (research R2,
R3). The rest already exists: 001's migration `0004_consent_and_write_scope.sql`
added `riders.scope_write` and `consent_records` together with this spec (research
R1). This file describes how the spec's Key Entities map onto that schema and onto
the new code.

## Stored

### Rider (`riders`, 001)

| Column | Used here for |
|---|---|
| `athlete_id` | the subject of every visibility check |
| `first_name` | what organisers see (FR-022); updated on every sign-in (001) |
| `scope_write` | whether write access was granted (FR-012); `/me` states it |
| `status` | not part of the role or of sharing (research R4, R6) |
| `organiser` (new) | INTEGER NOT NULL DEFAULT 0, `CHECK (organiser IN (0, 1))`: 1 marks an organiser (FR-001, FR-002) |

`organiser` is set and cleared only by the maintainer, in the database
([contracts/organiser-flag.md](contracts/organiser-flag.md)). The app reads it
with the row and never writes it: `insertRider` leaves the default 0,
`updateRiderOnReconnect` leaves it as it is. It is deleted with the row (FR-015).
`Rider` gains `organiser: boolean`.

The migration adds a column with a default and nothing else, so the deployed code
keeps working while CI applies it before publishing (migrations add, they
don't rename or drop).

No last name is stored (FR-022). 001's [data-model.md](../001-strava-connect-webhook/data-model.md)
`riders` table gets the column too, as it got `scope_write`, and
`test/integration/schema-minimisation.test.ts` lists it.

### Consent Record (`consent_records`, 001, unchanged)

| Column | Type | Rule |
|---|---|---|
| `athlete_id` | INTEGER | references `riders`, `ON DELETE CASCADE` (FR-015) |
| `version` | INTEGER ≥ 1 | the Consent Version accepted |
| `accepted_at` | INTEGER, epoch s | first acceptance of that version (`INSERT OR IGNORE`) |

Primary key `(athlete_id, version)`. The highest version is the rider's current
consent (`getCurrentConsent`). A rider who agrees to a new version gets one more
row; the older rows stay until the rider leaves (US4, research R13).

## In code (no storage)

### Consent Version (`src/consent.ts`, research R11)

`ConsentVersion`, one per published version (spec Key Entities):

| Field | Type | Rule |
|---|---|---|
| `version` | number | 1, 2, …; entries are ordered and consecutive |
| `published` | `"YYYY-MM-DD"` | the team's calendar day it was published |
| `requiredScopes` | `readonly string[]` | Strava scopes a rider must have granted; version 1: `read`, `activity:read` (FR-012) |
| `changes` | `readonly MessageId[]` | what grew compared with the version before; empty for version 1 |

| Constant | Value | Meaning |
|---|---|---|
| `CONSENT_VERSIONS` | `[version 1]` | the registry; production passes it as `Ctx.consentVersions` |
| `CONSENT_VERSION` | 1 (unchanged) | the last entry's number, for code without a `Ctx` |
| `SHARING_SINCE_VERSION` | 1 (new) | the lowest version whose consent includes the FR-020 sharing |

`Ctx.consentVersions` is non-empty; the last entry is the **current** version.

### Consent state (`consentState`, research R14)

Derived per request from the registry, the rider's highest accepted version and
`riders.scopes`; never stored:

| Accepted version | State | `changes` |
|---|---|---|
| ≥ current | `current` | — |
| none | `missing` | — |
| below current | `older` | the `changes` of every version after the accepted one, up to current, in order |

`viaStrava` is `true` for `missing`, and for `older` when a scope in the current
version's `requiredScopes` isn't in `riders.scopes`; otherwise `false`.

State transitions of a rider's consent:

```text
none ──agree via Strava──▶ current
older ──agree (POST /me/consent, or via Strava if viaStrava)──▶ current
current ──a new version is published──▶ older
any ──leave (disconnect, revoke, not a member)──▶ rider and records deleted
```

### Viewer (`src/http/viewer.ts`)

```ts
type Viewer =
  | { kind: "visitor" }
  | { kind: "rider"; rider: Rider; consentVersion: number | null };
```

`consentVersion` is the rider's highest accepted version, read with the row (US4,
research R15).

Derived per request, never stored (Key Entities "Role"):

```text
session cookie ──invalid/missing──▶ visitor
      │ valid
      ▼
riders row for the athlete? ──no──▶ visitor
      │ yes
      ▼
rider; organiser if rider.organiser
```

Without a rider row there is no flag, so only a connected rider can be an organiser
(FR-003). Consent doesn't enter the role (research R4).

### Audience and visibility (`src/visibility.ts`)

`audienceOf(viewer, subjectAthleteId)`:

| Viewer | Subject is the viewer | Audience |
|---|---|---|
| visitor | — | `visitor` |
| rider | yes | `self` |
| rider, `rider.organiser` true | no | `organiser` |
| rider, `rider.organiser` false | no | `rider` |

`VISIBILITY` (FR-020, FR-022). `self` sees all rows and isn't listed.

| `RiderData` | FR-020 row | `organiser` | `rider` |
|---|---|---|---|
| `firstName` | First name | yes | no |
| `profileLink` | "View on Strava" profile link (FR-022) | yes | no |
| `accumulatedRynke` | Training and Team Rynke accumulated, overall and per week, without a name | yes | yes |
| `progress` | Progress to both thresholds, whether they qualify | yes | no |
| `breakdown` | Breakdown by source, amounts still missing, virtual-ride share | yes | no |
| `attendance` | Attendance recorded for them | yes | no |
| `corrections` | Corrections recorded for them | yes | no |
| `rides` | Individual rides, ride results and activity figures | no | no |
| `consentRecords` | Consent records | no | no |

`SINCE_VERSION: Record<RiderData, number>`: the first consent version that
shares the item with others. Every item is `1` (`SHARING_SINCE_VERSION`) today
(US4, research R13).

`maySee(audience, data, subjectVersion)`, where `subjectVersion` is the subject's
highest accepted version or `null`:

1. `self` → `true`;
2. `visitor` → `false`;
3. `subjectVersion` is `null` or below `SINCE_VERSION[data]` → `false` (FR-021,
   FR-013);
4. otherwise `VISIBILITY[data].has(audience)`.

The subject's own role is not an input (FR-007).

### Shared riders (`src/db/consents.ts`)

A rider is **shared** for an item when a consent record with
`version >= SINCE_VERSION[item]` exists (research R6, R13).

| Export | Shape | Used by |
|---|---|---|
| `sharedRiderIdsSince(version)` | SQL subquery string, `SELECT athlete_id FROM consent_records WHERE version >= <version>` | team queries for an item: `… WHERE athlete_id IN (${sharedRiderIdsSince(SINCE_VERSION[item])})` |
| `SHARED_RIDER_IDS` | `sharedRiderIdsSince(SHARING_SINCE_VERSION)` | team queries, inside every aggregate (FR-021) |
| `listSharedRiderIds(db)` | `Promise<number[]>`, ascending | views that list riders |
| `consentVersionOf(db, athleteId)` | `Promise<number \| null>`, the highest accepted version | `readViewer`; `maySee`'s `subjectVersion` for a single rider |

Deleting a rider deletes their records by cascade, so they stop being shared in
the same statement (FR-015).

## Changed behaviour on `/me` (US1 edge case, research R1)

| Rider's consent state | `/me` |
|---|---|
| `current` | the page as today, with the consent section: version, date, `landing.dataRead`, `consent.organisers`, `consent.team` (FR-014) |
| `missing` | the gate: `me.consent.none` (reworded), the consent texts and the consent form posting to `POST /connect` (US1 R1, US4 R14) |
| `older` | the gate: what changed, the consent texts, and a form posting to `POST /me/consent`, or to `POST /connect` when `viaStrava` (US4 R14) |

The gate's layout is in [contracts/re-consent.md](contracts/re-consent.md).
