# Contract: Organiser HTTP Routes (Stories 1–3)

Every page renders inside the app shell with the Team tab current.

GET requests:
- A visitor gets `302 /`.
- A rider who hasn't agreed to the current consent meets the gate.
- A rider who is not an organiser gets `403` (the forbidden page).

POST requests:
- They need a same-origin `Origin`, a session, current consent and the organiser
  flag, read afresh (R1). Otherwise the answer is `403` and nothing changes.
- They answer `303` to the page named below, with `?done=<code>` on success or
  `?error=<code>` on a refusal (R3).

## Pages (GET)

| Path | Shows |
|---|---|
| `/organiser` | Event list, newest first: kind, date, name and attendee count, each linking to its page (FR-010). A "new event" form (kind, date defaulting to today, optional name). A link to `/organiser/riders`. |
| `/organiser/events/{id}` | The edit form (kind, date, name) and the change record. The attendance checklist of listed riders (FR-020), or only the list with a note when the event is in the future (FR-022). Delete inside a `<details>` confirmation (FR-013). An unknown id gives 404. |
| `/organiser/riders` | Listed riders by first name, with a Strava link where names clash, each linking to the rider's corrections. Says so when there are none. |
| `/organiser/riders/{athleteId}` | The rider's corrections, newest first: amounts, reason, date and change record, each with a confirmed "Remove". A form to add one (FR-030, FR-031). A rider who isn't listed gives 404. |

`/team` gains an "Organiser" link to `/organiser`, for organisers only (FR-002).

## Changes (POST)

| Path | Fields | Calls | Redirects to |
|---|---|---|---|
| `/organiser/events` | `kind`, `date`, `name` | `create-event` | `/organiser/events/{new id}?done=created` |
| `/organiser/events/{id}` | `kind`, `date`, `name` | `update-event` | `/organiser/events/{id}?done=saved` |
| `/organiser/events/{id}/delete` | — | `delete-event` | `/organiser?done=deleted` |
| `/organiser/events/{id}/attendance` | `attend` (repeated id), `shown` (repeated `id:0\|1`) | `add-attendance`, `remove-attendance` (R6) | `/organiser/events/{id}?done=attendance` |
| `/organiser/riders/{athleteId}/corrections` | `training`, `team`, `reason`, `date` | `add-correction` | `/organiser/riders/{athleteId}?done=added` |
| `/organiser/corrections/{id}/delete` | — | `remove-correction` | `/organiser/riders/{owner}?done=removed` |

An empty `name` means none, and both `name` and `reason` are trimmed. Empty
amounts mean 0.

## Refusal codes

Each code has a message in German and English under
`organiser.error.<code>`.

| Code | From | When |
|---|---|---|
| `unknown_kind`, `invalid_date`, `invalid_name` | 003 `TeamEventRefused` | As in 003 contracts/ride-evaluation.md. |
| `event_missing` | 003 | The event was deleted meanwhile. The redirect goes to `/organiser`. |
| `rider_not_connected` | 003 / R8 | A rider left or needs to reconnect. |
| `outside_season` | organiser layer (R5) | The date is before the season start or after the deadline. |
| `future_event` | organiser layer (R5) | Attendance was saved for an event after today. |
| `rider_not_listed` | organiser layer (R6) | An id in the form is not a listed rider. |
| `invalid_amount`, `invalid_reason`, `correction_missing` | `CorrectionRefused` (R8) | A bad amount or reason, or the correction is gone. |

The `done` codes `created`, `saved`, `deleted`, `attendance`, `added` and
`removed` each have a short confirmation under `organiser.done.<code>`.
