# Prompt: rider view

Independent of organiser-admin (see [README.md](README.md)).

```text
Specify the page where a rider sees their own Rynke.

Read first: specs/003-rynke-evaluation/spec.md (FR-014–FR-016, User Story 4, Key
Entities Ride Result and Rynke Balance), specs/001-strava-connect-webhook/spec.md (the
/me page with the 20 most recent rides, sign-in, FR-028–FR-030 languages),
docs/rynke-punkte.md (how the rules are explained to riders).

Only the signed-in rider sees their own data; it reads what feature 003 stores and
never triggers an evaluation. Show:
- Training Rynke and Team Rynke against the thresholds (250 / 25), the amounts still
  missing, and whether the rider qualifies, including the virtual-ride share
  (Training Rynke without virtual rides vs. 167).
- The breakdown: distance Rynke, the elevation total with its Rynke and the metres to
  the next step, each team-event kind (count and Rynke), corrections.
- Per ride: whether it counts, its distance Rynke and elevation metres, and every
  reason it doesn't count, in plain words (e.g. for an overlap, which ride counted
  instead). Elevation Rynke are not shown per ride, only in the total.
- The rules version and when it took effect; if a recalculation is still running,
  say that the numbers are being updated.
- A link to the rules handout.

Extend /me rather than adding a second page, unless planning shows a reason not to.
German labels "Trainingsrynke" and "Teamrynke"; all text in German and English via
the i18n catalogs.
```
