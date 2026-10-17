# Contract: HTTP Routes

Access as today unless said otherwise: a visitor gets `302 /`, a rider without
the current consent meets the gate, every POST checks the session's CSRF rules
like 014's organiser posts (`requireOrganiserPost`) and re-checks the role on
the server. Every POST answers `303` back to the page it came from with a notice
(`?done=…` or `?error=…`, 014's `redirectWith`).

## Riders (not organisers)

### `GET /events` — the Termine tab (FR-001–FR-007)

| Query | Values | Default |
|---|---|---|
| `past` | `all` shows every past event | the five newest past events |

- An organiser gets `302 /organiser` (research R8).
- Rendered in the shell with the Termine tab current ([pages.md](pages.md)).

### `POST /events/{id}/report` (FR-004, FR-005)

Creates the viewer's report (intent or request, by date). `303
/events#event-{id}`.

| Case | Result |
|---|---|
| allowed (research R13) | report stored, no notice (the button shows it) |
| report already there | nothing changes, same redirect |
| attendance already recorded | nothing, `?error=already_attending` |
| organiser | `403` |
| event missing or outside the counting window | `?error=event_missing` |

### `POST /events/{id}/report/delete` (FR-004)

Withdraws an intent. `303 /events#event-{id}`.

| Case | Result |
|---|---|
| event not yet taken place | report deleted, no notice |
| event taken place | nothing, `?error=event_over` |
| no report | nothing, same redirect |

## Organisers

### `GET /organiser` — Termine (014's event list, extended)

Now starts with the open requests grouped by event, then 014's list with
"n offen" and "n zugesagt" chips, "n Personen[, inklusive dir]" and the "Ich war
auch dabei" forms ([pages.md](pages.md)). The notice of a quick decision carries
the undo form.

### `GET /organiser/riders` — overview (016, extended)

| Query | Values | Default |
|---|---|---|
| `group` | `push`, `on_track`, `in`, **`requests`**, `all` | as 016 |

`requests` shows the riders with open requests (FR-034).

### `GET /organiser/events/{id}` — event page (014, extended)

Tri-state boxes and their legend (FR-040–FR-044); reports of an upcoming event
as locked grey boxes.

### `POST /organiser/events/{id}/attendance` (014, extended)

Besides 014's `attend` and `shown={id}:{0|1}` fields:

| Field | Meaning |
|---|---|
| `shown={id}:r` | the rider was shown with an open request |
| `decide-{id}` | `open`, `yes` or `no` |

`yes` records attendance (and clears the report, research R3), `no` deletes the
report, `open` changes nothing. A `decide-{id}` for a rider whose report is gone
meanwhile changes nothing. Notice: `?done=attendance` with "n eingetragen, n
abgelehnt, n offen" (FR-042).

### `POST /organiser/requests` (FR-031, FR-034)

| Field | Values |
|---|---|
| `event` | event id |
| `athlete` | one or more athlete ids |
| `decision` | `confirm`, `deny` |
| `back` | `/organiser` or `/organiser/riders?group=…` (anything else counts as `/organiser`) |

`303 {back}` with `?done=confirmed` or `?done=denied` and `&undo={token}`
(research R4); the page renders the riders' first names from the token's ids and
the undo form with the token. Riders without a report at the event are skipped; if none
is left, `?error=request_settled`. An event not yet taken place:
`?error=future_event`.

### `POST /organiser/requests/undo` (FR-032)

| Field | Values |
|---|---|
| `token` | the signed undo token |
| `back` | as above |

Valid token: confirm → removes the attendance it added and restores the reports;
deny → restores the reports; both with their old `reported_at`. `303 {back}`
with `?done=undone`. Expired or invalid: `?error=undo_expired`, nothing changes.

### `POST /organiser/events/{id}/self` (FR-036)

Records the viewing organiser's attendance at an event that has taken place.
`303 /organiser#event-{id}` with `?done=attendance`. Upcoming event:
`?error=future_event`.
