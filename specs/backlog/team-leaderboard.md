# Prompt: team leaderboard and organiser overview

Needs roles-and-consent; easier after rider-view (see [README.md](README.md)).

```text
Specify the team leaderboard and the organiser overview of RynkePoints. Seeing each
other's progress is the purpose of the app: it should motivate riders to train for
the team.

Read first: .specify/memory/constitution.md (Principle I),
specs/004-roles-and-consent/spec.md (FR-020–FR-022: who sees what, no names on the
leaderboard), specs/003-rynke-evaluation/spec.md
(FR-013, FR-013a, FR-014a, FR-015), the rider-view spec if it exists.

Team leaderboard (every signed-in rider):
- Every consenting rider's accumulated Training Rynke and Team Rynke, without names:
  no name, athlete ID, profile link or picture; the viewer's own row may be marked.
  Decide the ordering.
- A week-by-week graph of the accumulated Rynke (decide per rider row, for the
  team, or both).
- Riders without a current consent are left out of every row, count and figure.
- Nothing beyond accumulated Rynke; no individual rides of other riders.

Organiser overview (organisers only):
- Every consenting rider by first name: totals, breakdown, amounts missing,
  qualified or not, so organisers can see who needs help before the qualification
  deadline. A list of who qualified. Riders with the same first name get a "View on
  Strava" link (roles-and-consent FR-022).
- Riders without a current consent are left out.

Both read what feature 003 stores and never trigger an evaluation. German and English
via the i18n catalogs.
```
