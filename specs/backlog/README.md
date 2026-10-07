# Spec backlog

Prompts for features that don't have a spec yet. Each file holds one prompt to
paste into `/speckit.specify` in a fresh session (on a fresh branch from
`develop`); then run the usual `/speckit.clarify`, `/speckit.plan`,
`/speckit.tasks` and `/speckit.implement`. Delete the prompt file in the same
branch once its spec exists.

This directory has no number prefix on purpose, so Spec Kit's feature numbering
ignores it.

## Order

1. roles and consent — specified in
   [004-roles-and-consent](../004-roles-and-consent/spec.md); first, while there are no
   users: which roles and which rider consents the app needs, and whether Strava
   allows the leaderboard at all. Everything below depends on it.
2. [organiser-admin.md](organiser-admin.md) — organiser pages for the inputs of
   feature 003 (team events, attendance, corrections, rules, recalculation).
3. rider view — specified in [005-rider-view](../005-rider-view/spec.md); a
   rider's own balance and ride results.
4. [team-leaderboard.md](team-leaderboard.md) — the team leaderboard and the
   organiser overview (who qualified). The main purpose of the app.

2 and 3 are independent of each other; 4 needs 1 and is easier after 3.
