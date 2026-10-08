# Quickstart: Organiser Administration (Stories 1–3)

## 1. Automated checks

`pnpm test`, `pnpm lint` and `pnpm typecheck` must pass. The tests use synthetic
riders only. Each test below is written first and must fail before the code
exists.

| Area | Test | Covers |
|---|---|---|
| Access | `organiser-access`: a visitor GET gives 302 `/`. A rider without the flag gets 403 on every GET and POST route, and nothing changes. A POST from another origin gives 403. A flag cleared between GET and POST gives 403. `/team` shows the link to organisers only. | FR-001, FR-002, SC-002 |
| Events | `organiser-events`: create with today's date and no name; update kind, date and name; delete one that has attendance (its attendance is gone and the balances follow); a date outside the season gives `outside_season`; an update to an event deleted meanwhile gives `event_missing`; the list is newest first and shows the attendee count. | FR-010–FR-013 |
| Attendance | `organiser-attendance`: tick 2 of 3 riders; tick again (credited once); untick; tick a rider for an event before they connected; same first names get Strava links; a rider without consent is not listed and is untouched by a save; a future event gives `future_event` and has no form; a forged id gives `rider_not_listed`; a second organiser's tick survives the first organiser's save. | FR-020–FR-022, SC-003 |
| Corrections | `organiser-corrections`: add +10 Training (the balance includes it); both amounts 0, a non-integer or an empty reason are refused; remove one (the balance follows); −20 Team for a rider with 5 gives 0; a full re-evaluation (`evaluate-rider`) keeps corrections. | FR-030, FR-031, 003 FR-010 |
| Change record | The rows carry `changed_by` and `changed_at`. Deleting the organiser rider shows "former organiser". | FR-040, SC-005 |
| Copy | `no-hardcoded-copy` and the catalog parity tests cover the `organiser.*` keys. | FR-043 |
| Unit | Correction validation; `extrasFrom` with attendance plus corrections; `tally` clamping a negative correction. | R7, R8 |

## 2. Local walk-through (`pnpm dev`)

1. Run `pnpm dev`, open `http://localhost:8789` and sign in as the sample
   organiser "Tina TrainingDone".
2. Go to Team → Organiser. Add a team training for today, open it, tick three
   riders and save. Then check the "Saved" note and the ticks.
3. On a phone-width window (360 px), check there is no horizontal scrolling on
   any organiser page (FR-044).
4. Riders → pick one, add +10 Training Rynke "Ride lost, broken device", then
   check the Overview of that rider (sign in as them) shows the higher balance.
5. Sign in as a sample rider without the flag and check `/organiser` gives "not
   allowed".

## 3. After release

The maintainer checks once on the live site with a real organiser. There are
no tasks for this.
