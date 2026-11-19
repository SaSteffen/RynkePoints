# Spec backlog

Prompts for features that don't have a spec yet. Each file holds one prompt to
paste into `/speckit.specify` in a fresh session (on a fresh branch from
`develop`); then run the usual `/speckit.clarify`, `/speckit.plan`,
`/speckit.tasks` and `/speckit.implement`. Delete the prompt file in the same
branch once its spec exists.

This directory has no number prefix on purpose, so Spec Kit's feature numbering
ignores it.

## Open

- season data cleanup — [season-data-cleanup.md](season-data-cleanup.md);
  what happens to the past season's data at the rollover, after feature 021's
  season albums, done in a downtime window in late August or early September.
  Decide before the next rollover (1 September), for every team,
  Sponsoring-Rynke's season included.
- gateway routing — [gateway-routing.md](gateway-routing.md); the gateway
  sends each Strava event only to the teams that hold the athlete, instead of
  to every team. Comes with or after the third team and the paid plan.

Every earlier prompt here has its spec under `specs/` and was deleted with it.
