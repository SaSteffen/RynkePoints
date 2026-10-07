# Prompt: a rider's progress over time

Needs rider-view (005); best specified next to team-leaderboard.md, whose
week-by-week graph could share the chart (see [README.md](README.md)).

```text
Specify line charts on the rider page of RynkePoints that show how a rider's own
Rynke grew over the season. Feature 005 shows only the current state (its FR-024);
this feature adds the history.

Read first: .specify/memory/constitution.md (Principles I and IV),
specs/005-rider-view/spec.md (FR-003, FR-004, FR-024, FR-025, FR-070–FR-072),
specs/003-rynke-evaluation/spec.md (what is stored per ride, per balance and per
team event), specs/backlog/team-leaderboard.md (its week-by-week graph).

What the charts show:
- Training Rynke and Team Rynke over the season, from the season start to today
  (or the qualification deadline), with the targets as lines. Decide whether
  distance, elevation, team-event kinds and corrections get their own lines.
- Decide the time step (day or week) and how a week is defined (Europe/Berlin,
  Monday first).
- Every point carries its figures as text too, like the gauges (005 FR-025); the
  charts work at 360 px and need no extra JavaScript library unless the plan
  justifies one.

Where the history comes from:
- The app stores only each rider's current balance, not past balances. Decide
  whether the history is rebuilt from the stored ride results and event dates
  under the balance's rules version (the elevation steps make this non-trivial),
  or whether past balances are stored from now on. The page still never
  evaluates or calls Strava (005 FR-003).
- A rules change rewrites the whole curve under the new version; say how that is
  shown.

Only the signed-in rider's own data. German and English via the i18n catalogs.
```
