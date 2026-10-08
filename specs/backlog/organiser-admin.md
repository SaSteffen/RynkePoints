# Prompt: organiser administration

Needs roles-and-consent (see [README.md](README.md)).

```text
Specify the organiser pages of RynkePoints.

Read first: .specify/memory/constitution.md, specs/003-rynke-evaluation/spec.md (FR-006,
FR-006a, FR-007, FR-010, FR-011, FR-012, FR-021–FR-026, Key Entities),
specs/004-roles-and-consent/spec.md (who is an organiser, what organisers may see about riders),
specs/001-strava-connect-webhook/spec.md (sign-in, Team Settings, failure records).

Only organisers reach these pages; everyone else gets "not allowed". Organisers can:
- Team events: create, change and delete (kind, date, optional name; a training
  weekend is one event per day). List the season's events.
- Attendance: for an event, tick the connected riders who attended, untick to
  remove. Recording a rider twice changes nothing. Past events can be filled in
  for riders who connected later. Which riders appear and how they are named follows
  the roles-and-consent spec.
- Corrections: add a signed Training and/or Team Rynke amount with reason and date
  to a rider; remove one. Show a rider's corrections.
- As a separate independent user story, to be implemtned much later: Rules: view and change the rule values of feature 003 FR-012 (including the
  qualification deadline and the excluded sport types). A change creates a new rules
  version and triggers recalculation (FR-021, FR-023). Changes that need data the app
  doesn't store are refused (FR-025).
- As a separate independent user story, to be implemtned much later: Recalculation: start a full recalculation (FR-024) and see whether one is running.
- As a separate independent user story, to be implemtned much later Optionally: Team Settings from feature 001 (season start, club) instead of
  deployment configuration.

Every change records which organiser made it and when, kept as long as the input
exists. Changes take effect through feature 003 (FR-003); this feature computes
nothing itself. Seeing other riders' balances or who qualified is not part of this
feature (team-leaderboard spec). German and English via the i18n catalogs; organisers
use phones at the training ground, so pages must work on a small screen.
```
