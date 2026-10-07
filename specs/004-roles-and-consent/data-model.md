# Data Model: Roles and Rider Consent (User Stories 1–3)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

No migration. Everything stored for this feature already exists: 001's migration
`0004_consent_and_write_scope.sql` added `riders.scope_write` and
`consent_records` together with this spec (research R1). This file describes how
the spec's Key Entities map onto that schema and onto the new code.

## Stored (unchanged)

### Rider (`riders`, 001)

| Column | Used here for |
|---|---|
| `athlete_id` | the subject of every visibility check; matched against the Organiser List |
| `first_name` | what organisers see (FR-022); updated on every sign-in (001) |
| `scope_write` | whether write access was granted (FR-012); `/me` states it |
| `status` | not part of the role or of sharing (research R4, R6) |

No last name is stored (FR-022).

### Consent Record (`consent_records`, 001)

| Column | Type | Rule |
|---|---|---|
| `athlete_id` | INTEGER | references `riders`, `ON DELETE CASCADE` (FR-015) |
| `version` | INTEGER ≥ 1 | the Consent Version accepted |
| `accepted_at` | INTEGER, epoch s | first acceptance of that version (`INSERT OR IGNORE`) |

Primary key `(athlete_id, version)`. The highest version is the rider's current
consent (`getCurrentConsent`).

## In code (no storage)

### Consent Version (`src/consent.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `CONSENT_VERSION` | 1 (unchanged) | the version the forms ask for today |
| `SHARING_SINCE_VERSION` | 1 (new) | the lowest version whose consent includes the FR-020 sharing |

### Organiser List (`ORGANISER_ATHLETE_IDS`)

A Worker secret ([contracts/configuration.md](contracts/configuration.md)): Strava
athlete IDs separated by commas and/or whitespace. Read on every request by
`organiserIds(value)` in `src/roles.ts`:

- `undefined`, `""` or only separators → empty set (FR-006);
- entries that aren't positive decimal integers are ignored (research R3);
- duplicates collapse.

### Viewer (`src/http/viewer.ts`)

```ts
type Viewer =
  | { kind: "visitor" }
  | { kind: "rider"; rider: Rider; organiser: boolean };
```

Derived per request, never stored (Key Entities "Role"):

```text
session cookie ──invalid/missing──▶ visitor
      │ valid
      ▼
riders row for the athlete? ──no──▶ visitor
      │ yes
      ▼
rider, organiser = organiserIds(env).has(athleteId)
```

An ID on the list grants nothing without a rider row (FR-003). Consent doesn't
enter the role (research R4).

### Audience and visibility (`src/visibility.ts`)

`audienceOf(viewer, subjectAthleteId)`:

| Viewer | Subject is the viewer | Audience |
|---|---|---|
| visitor | — | `visitor` |
| rider | yes | `self` |
| rider, `organiser: true` | no | `organiser` |
| rider, `organiser: false` | no | `rider` |

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

`maySee(audience, data, subjectShared)`:

1. `self` → `true`;
2. `visitor` → `false`;
3. `subjectShared` is `false` → `false` (FR-021);
4. otherwise `VISIBILITY[data].has(audience)`.

The subject's own role is not an input (FR-007).

### Shared riders (`src/db/consents.ts`)

A rider is **shared** when a consent record with `version >= SHARING_SINCE_VERSION`
exists (research R6).

| Export | Shape | Used by |
|---|---|---|
| `SHARED_RIDER_IDS` | SQL subquery string, `SELECT athlete_id FROM consent_records WHERE version >= 1` | team queries: `… WHERE athlete_id IN (${SHARED_RIDER_IDS})`, inside every aggregate (FR-021) |
| `listSharedRiderIds(db)` | `Promise<number[]>`, ascending | views that list riders |
| `isShared(db, athleteId)` | `Promise<boolean>` | `maySee`'s `subjectShared` for a single rider |

Deleting a rider deletes their records by cascade, so they stop being shared in
the same statement (FR-015).

## Changed behaviour on `/me` (US1 edge case, research R1)

| Rider's current consent | `/me` consent section |
|---|---|
| a record exists | as today: version, date, `landing.dataRead`, `consent.organisers`, `consent.team` |
| none | `me.consent.none` (reworded), then the consent texts and the consent form posting to `POST /connect` |
