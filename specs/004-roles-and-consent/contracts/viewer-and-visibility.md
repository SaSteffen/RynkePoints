# Contract: viewer, roles and visibility for views

**Feature**: [spec.md](../spec.md) | **Research**: R4–R7, R13–R15 | **Data model**:
[data-model.md](../data-model.md)

This feature builds no view that shows one rider's data to another. This contract is
what the planned views (organiser-admin, team-leaderboard) build on, so they all
read the consent the same way (US3).

## `src/http/viewer.ts`

```ts
export type Viewer =
  | { kind: "visitor" }
  | { kind: "rider"; rider: Rider; consentVersion: number | null };
  // rider.organiser: the flag (R2); consentVersion: highest accepted (R15)

/** Who is asking, decided afresh on every request (FR-003). */
export function readViewer(request: Request, ctx: Ctx): Promise<Viewer>;

/** `302 /` for a visitor (where they sign in with Strava), else null. */
export function requireRider(viewer: Viewer): Response | null;

/** `302 /me` (the consent gate) unless the rider's consent is current (R14). */
export function requireConsent(viewer: Viewer, ctx: Ctx): Response | null;
```

Rules every page follows:

- Call `readViewer` once per request. Never put the role in a cookie or keep it
  between requests; `riders.organiser` is the only place it lives.
- A page for signed-in riders starts with `requireRider`, then `requireConsent`
  (`/me` itself shows the gate instead, [re-consent.md](re-consent.md)).
- An organiser page checks `viewer.rider.organiser` and answers a non-organiser
  rider the way organiser-admin's spec says ("not allowed"); that wording is that
  feature's.

## `src/visibility.ts`

```ts
export type RiderData =
  | "firstName" | "profileLink" | "accumulatedRynke" | "progress"
  | "breakdown" | "attendance" | "corrections" | "rides" | "consentRecords";

export type Audience = "self" | "organiser" | "rider" | "visitor";

export const VISIBILITY: Readonly<Record<RiderData, ReadonlySet<Audience>>>;

/** The first consent version that shares each item with others (R13). */
export const SINCE_VERSION: Readonly<Record<RiderData, number>>;

export function audienceOf(viewer: Viewer, subjectAthleteId: number): Audience;

export function maySee(
  audience: Audience,
  data: RiderData,
  subjectVersion: number | null, // the subject's highest accepted version
  since?: Readonly<Record<RiderData, number>>, // defaults to SINCE_VERSION; tests only
): boolean;
```

Pure: no D1, no clock, no text. The table is in [data-model.md](../data-model.md).

Rules every view follows:

- Before showing a piece of data about a rider to someone, it asks `maySee`.
  Data that has no `RiderData` value is shown only to the rider themselves.
- A leaderboard row for another rider carries no name, athlete ID, profile link,
  picture or anything else that names the rider (FR-020). The viewer's own row
  (`self`) may be marked.
- Organisers get `profileLink` (`https://www.strava.com/athletes/<id>`, text
  "View on Strava") at least when two shared riders have the same first name
  (FR-022). The link is the only place an athlete ID may appear, and only on
  organiser pages.

## `src/db/consents.ts`

```ts
/** SQL subquery: athlete IDs whose accepted consent reaches `version`. */
export function sharedRiderIdsSince(version: number): string;

/** SQL subquery: athlete IDs whose consent includes the FR-020 sharing. */
export const SHARED_RIDER_IDS: string; // sharedRiderIdsSince(SHARING_SINCE_VERSION)

export function listSharedRiderIds(db: D1Database): Promise<number[]>;
export function consentVersionOf(
  db: D1Database,
  athleteId: number,
): Promise<number | null>;
```

Rules every view follows:

- Every query that lists, counts, sums, averages or ranks riders for someone other
  than the rider filters with `athlete_id IN (${SHARED_RIDER_IDS})` inside the
  query, so a rider without consent is in no row and no figure (FR-021). A query
  for an item whose `SINCE_VERSION` is above `SHARING_SINCE_VERSION` uses
  `sharedRiderIdsSince(SINCE_VERSION[item])` instead (FR-013).
- Filtering a result in TypeScript is not enough for figures computed in SQL.
