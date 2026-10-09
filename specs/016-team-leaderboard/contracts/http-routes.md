# Contract: HTTP Routes

Both pages render inside the app shell with the Team tab current, and only read
(research R11). Neither has a POST.

## `GET /team` (every signed-in rider)

| Query | Values | Default |
|---|---|---|
| `kind` | `training`, `team` | `training` |
| `all` | `1` shows every row | the neighbourhood |

- An unknown value counts as the default; nothing answers 400.
- A visitor gets `302 /`; a rider without current consent meets the gate (as
  today).
- The switch and toggle are links to the four combinations. Each keeps the other
  parameter, so switching the kind keeps "Everyone".
- Organisers reach `/organiser/riders` through the "Orga" tab left of Settings,
  not from this page (FR-002, research R8).

## `GET /organiser/riders` (organisers only)

Replaces 014's plain rider list (research R8). Access as every 014 organiser page:
visitor `302 /`, gate without current consent, `403` for a rider who isn't an
organiser.

| Query | Values | Default |
|---|---|---|
| `group` | `push`, `on_track`, `in`, `all` | none: every rider rendered, CSS shows "Need a push" below 840 px (research R9) |

- Once the deadline has passed, `on_track` is treated as `all` and its tile is not
  shown (data-model.md `RiderStatus`).
- Each rider links to `/organiser/riders/{athleteId}` (014's corrections page,
  unchanged).
- `/organiser` keeps its link here; its text becomes "Team overview".

## Unchanged

`/organiser/riders/{athleteId}` and every 014 POST route keep their behaviour.
Their "Back to the riders" link now leads back to the overview.
