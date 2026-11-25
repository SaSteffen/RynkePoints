# Research: Dismiss Day Warnings

Decisions for the open choices of [spec.md](spec.md). Each: decision, rationale, alternatives.

## R1 Where dismissals live

**Decision**: A new D1 table, `usage_dismissals`, one row per administrator, kind of day
warning, day and reason. The administrator's athlete ID references `riders` with
`ON DELETE CASCADE`, so the row goes with the rider (FR-009). Inserting is
`INSERT OR IGNORE`, so a double tap or a second tab changes nothing (edge case "Dismissing
twice").

**Rationale**: Per administrator and across devices (FR-004) needs the server; each team's D1 is
its own, so a dismissal can't cross teams (FR-012). One row per reason makes "covers the reasons
it had" (FR-006) a plain lookup with no JSON in a column, and growth of a reason can't matter
because no count is kept.

**Alternatives**: Browser storage: per device, not per administrator (FR-004). One row per day
with the reasons as a list: needs parsing and a merge on a second dismissal. A column on `riders`:
a list per rider in one cell, and riders' rows would carry admin-view state.

## R2 Reasons

**Decision**: Each day item carries its reasons as short fixed words:

| Kind | Reasons |
|---|---|
| `calls` (Strava calls) | `calls` |
| `recheck` (ride re-check) | `over24h`, `unordered` |
| `routing` (gateway routing) | `missed`, `possible`, `everyone` (feature 046's `RoutingWarning`) |

The re-check item's two flags become a reason list; the routing item keeps its list; the calls
item gets its one reason. The row's text is unchanged.

**Rationale**: The spec's "reason" is what the row names (Context and terms). Strava calls have one
mark, whether the counts don't add up or a call went unassigned, and the row doesn't tell them
apart, so neither does a dismissal.

## R3 Where dismissed items are left out

**Decision**: `attentionItems` takes the viewer's dismissals and leaves out a day item when every
reason it has now was dismissed. `readUsageState`, which already takes the viewer's athlete ID,
reads them beside its other reads. The page's list, its head (`markCount`) and the Admin tab's
number all come from the same items, so they stay equal (FR-003, SC-002). The day tables read
their marks from their own rows, not from the list, so their marks stay (FR-005).

**Rationale**: Feature 048 put "what needs a look" in one pure function so the page and the Admin
tab can't disagree; filtering there keeps that. A new reason makes "every reason dismissed" false,
so the row comes back with all its reasons (FR-006, SC-004) without any extra state.

**Alternatives**: Filtering in the page and the Admin tab separately: two places that can drift.
Filtering in SQL: the reasons are worked out from counts in code, not in the database.

## R4 The route

**Decision**: `POST /admin/dismiss`, behind `requireAdminPost` (same origin, signed in, agreed,
Administrator; anything else a 403). The form sends `kind`, `day` and one `reason` field per reason
the row showed. The handler keeps only a known kind, a day that is today or yesterday (UTC), and
reasons known for that kind; with at least one left it inserts them. It answers `303` to `/admin`
either way, as `/admin/alerts` does. The form carries `data-swap`, so the page script posts it and
swaps the answer in place: the list, its head and the navigation with the Admin tab's number
(FR-007). See [contracts/dismiss-route.md](contracts/dismiss-route.md).

**Rationale**: The reasons come from what the administrator saw, not from the server's current
state: a reason that arrived after the page was drawn wasn't looked at and must not be covered
(FR-006). The checks keep the table bounded to the list's two days and known words. The in-place
save already handles failure: offline or on a server error it falls back to the browser's own
submit, which shows the error, and nothing was stored, so the row stays (edge case "Dismissing
fails").

**Alternatives**: Reading the current reasons on the server: could cover a reason the
administrator never saw. A JSON endpoint with its own client code: the in-place save already does
it, with no new script.

## R5 The control

**Decision**: A text button "Gesehen" (English "Got it") at the end of each day row, in a small
form beside the row's link, not inside it. Its accessible name names the row: "Gesehen:
Gateway-Routing: 25.11.2026" (`admin.lage.dismissLabel`, with the row's title). Figure, CPU and
state-hint rows get no form (FR-002). The row's list item lays out link and form on one line; on a
phone the title wraps, the button keeps its place and its touch size.

**Rationale**: A button can't sit inside a link. A visible word says what happens better than an
icon, and the label tells a screen reader which row it is for (FR-010). Keyboard order follows the
markup: row link, then its button.

**Alternatives**: A cross icon: reads as "delete" or "close", and the warning isn't deleted. A
swipe: no keyboard or screen reader way.

## R6 Clean-up

**Decision**:

- The daily run's `pruneUsage` deletes dismissals of days before yesterday, the days the list no
  longer shows (FR-009).
- `setRole` deletes the rider's dismissals when the new role isn't Administrator (edge case
  "loses the Admin role").
- Deleting a rider deletes them through the foreign key.

**Rationale**: The daily run already prunes the usage tables; one more statement there. A former
administrator no longer sees the list, so their dismissals have no use.

## R7 Privacy notice

**Decision**: No change to the notice or the consent.

**Rationale**: A dismissal holds no Strava data and nothing about any rider's riding; it is the
administrator's own state of the admin view, like their notification switch (feature 025), kept
for about two days and deleted with them. The notice's "All data about you is deleted" already
covers it. Nothing new is read from Strava or shown to anyone (Principle I).

## R8 Migration safety

**Decision**: `0043_usage_dismissals.sql` only creates the table.

**Rationale**: The release before never reads it, so applying the migration before publishing the
code keeps that release working (CLAUDE.md).
