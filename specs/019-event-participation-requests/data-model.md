# Data Model: Riders Report Team-Event Participation

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-17

One new table; everything else is read from what 003, 004 and 014 store.

## Participation report (new)

Migration `migrations/0017_participation_reports.sql`, only adding a table so the
previously deployed version keeps working:

```sql
CREATE TABLE participation_reports (
	event_id INTEGER NOT NULL REFERENCES team_events (event_id) ON DELETE CASCADE,
	athlete_id INTEGER NOT NULL REFERENCES riders (athlete_id) ON DELETE CASCADE,
	-- Unix ms; orders requests and survives an undo (research R4).
	reported_at INTEGER NOT NULL,
	PRIMARY KEY (event_id, athlete_id)
);

CREATE INDEX participation_reports_by_rider ON participation_reports (athlete_id);
```

| Field | Meaning | Rules |
|---|---|---|
| `event_id` | the team event | deleted with the event (FR-022) |
| `athlete_id` | the rider who reported | deleted with the rider (FR-022) |
| `reported_at` | when they tapped | set on insert; restored as it was by an undo |

No kind, no decision, no organiser: whether a report is an intent or a request
follows from the event's date (research R1, R2); a decision deletes it.

### Derived state

For a rider and an event, computed in `src/rynke/participation.ts` (pure):

| Event | Attendance | Report | State shown to the rider | Counts for organisers as |
|---|---|---|---|---|
| not taken place | – | none | "Bin dabei" | – |
| not taken place | – | yes | intent: green "Bin dabei ✓" / "Doch nicht dabei" | "zugesagt" |
| taken place | no | none | "Ich war dabei" | – |
| taken place | no | yes | request: green "Ich war dabei ✓", locked | **open request** |
| taken place | yes | – (deleted, R3) | "Du warst dabei" | – |

An event outside the counting window shows nowhere and counts nowhere.

### Transitions

```text
                rider taps "Bin dabei" (before the date)
   (none) ───────────────────────────────────────────▶ intent
     ▲  ▲                                                 │ event date reached
     │  └─────── rider taps "Doch nicht dabei" ◀──────────┤ (no write)
     │                                                    ▼
     │   rider taps "Ich war dabei" (from the date) ──▶ request
     │                                                    │
     ├──── organiser denies (box emptied, ✕) ◀────────────┤
     │                                                    │ organiser confirms
     │                                                    ▼ (any attendance, R3)
     └──── undo of a denial ─▶ request          attendance recorded, report deleted
                                                 undo: attendance removed, request back
```

Moving an event's date across today moves its reports between intent and
request with it (spec edge cases).

### Validation (server side, research R13)

- Create: the viewer is signed in, agreed to the current consent, listed, not an
  organiser; the event exists and lies in the counting window; the viewer has no
  attendance there. An existing report is left as it is (insert or ignore).
- Withdraw: the same, plus the event has not taken place.
- Confirm/deny: the viewer is an organiser; the event has taken place; only riders
  who still have a report there are changed.

## Undo token (not stored)

A value signed with `signValue` (`src/crypto/sign.ts`, context
`"request-undo"`), expiring after 10 minutes:
`{decision}-{eventId}-{athleteId_athleteId…}-{reportedAt_reportedAt…}`. It lets
`POST /organiser/requests/undo` restore exactly what a decision changed and
nothing else (research R4).

## Reads (`src/db/participation.ts`)

| Statement | Used by | Returns |
|---|---|---|
| `openRequestCountStatement` | `shellPage` for organisers | one number (FR-030) |
| `listOpenRequestsStatement` | `/organiser`, `/organiser/riders` | event, rider, first name, `reported_at`, newest event first (FR-031, FR-034) |
| `listEventReportsStatement` | `/organiser/events/{id}` | `athlete_id` of each report at the event (FR-040–FR-043) |
| `countIntentsStatement` | `/organiser` | intents per upcoming event (FR-033) |
| `listRiderEventsStatement` | `/events` | the counting window's events with the viewer's attendance and report (FR-001–FR-006) |

Every statement filters riders with 014's `LISTED_RIDER_IDS` and events with the
counting window; the open-request condition is one shared fragment (research R7).

## Writes

| Statement | Called by |
|---|---|
| `insertReportStatement` (`INSERT OR IGNORE`) | `POST /events/{id}/report`; undo (with the old `reported_at`) |
| `deleteReportStatement` | `POST /events/{id}/report/delete`; deny |
| `deleteReportsStatement(eventId, athleteIds)` | `applyTeamEventChange` `add-attendance` (R3); deny of several |

## Visibility (`src/visibility.ts`)

`participationReports: ORGANISER_ONLY`, since `SHARING_SINCE_VERSION` (research
R11). Riders see only their own reports; nobody sees counts of others' reports
except organisers (FR-010).

## Unchanged

`team_events`, `attendances` and their change records (014), balances (003). The
Team page reads 016's data minus the peloton (research R12).
