# Prompt: team leaderboard and organiser overview

Needs roles-and-consent; easier after rider-view (see [README.md](README.md)).

```text
Specify the team leaderboard and the organiser overview of RynkePoints. Seeing each
other's progress is the purpose of the app: it should motivate riders to train for
the team.

Read first: .specify/memory/constitution.md (Principle I), the roles-and-consent spec
(consent levels and how non-consenting riders appear), specs/003-rynke-evaluation/spec.md
(FR-013, FR-013a, FR-014a, FR-015), the rider-view spec if it exists.

Team leaderboard (every signed-in rider):
- Riders who consented to share with the team, with Training Rynke and Team Rynke,
  progress towards both thresholds and whether they qualify. Decide the ordering and
  what to show beyond totals (e.g. this week's Rynke).
- Riders who did not consent are left out (or counted anonymously, as decided by the
  roles-and-consent spec); consent changes show up immediately.
- Nothing beyond the balance; no individual rides of other riders unless the
  roles-and-consent spec allows it.

Organiser overview (organisers only):
- Every rider who consented to share with organisers: totals, breakdown, amounts
  missing, qualified or not, so organisers can see who needs help before the
  qualification deadline. A list of who qualified.
- Riders who didn't consent appear only as far as that spec allows.

Both read what feature 003 stores and never trigger an evaluation. German and English
via the i18n catalogs.
```
