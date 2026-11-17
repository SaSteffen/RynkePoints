# Quickstart: Checking Team Europe's Own Rules

## Automated

```bash
pnpm test -- test/teams test/unit/rules.test.ts test/unit/fixable-reasons.test.ts
node scripts/team-check.mjs
```

Expected:
- `season-snapshot.test.ts` and `pages-snapshot.test.ts` (Hamburg) pass **without** `-u`: Hamburg's
  pages are byte-identical to before (SC-001).
- `test/unit/rules.test.ts` passes unchanged: Hamburg's version 3 and fingerprint (FR-002).
- `team:europe`'s `no-events.test.ts` finds no Team Rynke, event, attendance or tour-day text on any
  Europe page (SC-004).
- `team-check` prints nothing; it would name a team with Team Rynke but no event kinds, or a
  missing other-team club.

## By hand, in fake mode

`pnpm dev` serves both teams (http://localhost:8791 via the gateway; Hamburg on
http://localhost:8789, Europe on http://europe.localhost:8790).

1. **Hamburg unchanged**: sign in as any Hamburg sample rider and an organiser. Team Rynke gauge,
   Team view on `/team`, Events in the menu, Orga's events, the tour's Team Rynke step: all there as
   before. A 5 km ride of a Hamburg sample counts.
2. **Europe's short rides**: sign in to Europe as `Siiri ShortRide`, with the 24.9 / 25.0 / 60 km
   rides. On `/me/rides` the 24.9 km ride shows "Too short: 24.9 km, at least 25 km needed."; the
   others count. Settings › Rules says "Rides of 25 km or more count."
3. **Europe without Team Rynke**: as `Tuuli TrainingDone`, `/me` shows one verdict on Training Rynke
   and the outdoor share, no Team gauge; `/team` has no kind switch; the menu has no Events;
   `/events` is 404. Switch the language to German and look again.
4. **Europe's Orga**: as Europe's organiser, Orga opens on the riders without a Team column and
   without the Riders · Events switch; `/organiser` lands on `/organiser/riders`; a correction offers
   only Training.
5. **Europe's badges**: `/me/badges` has no Team events, Technique, Tour de Paris, Big training or
   Attendances badges; the team badges for distance, elevation, running, Training Rynke and the
   surprises are there.
6. **Both clubs**: fake mode seeds `Britt BothClubs`, who is in both clubs, through the
   one-team-at-a-time notice. To see the notice by hand, leave the team as her (Settings) and connect
   her again: the notice shows once.
7. **Tours**: restart the tour on Europe (Settings): no Team Rynke or Events step; the organiser tour
   has only the Riders steps.

## After the release

- Hamburg's daily run re-evaluates nobody (its rule version is still 3).
- The user runs **Sandbox reseed** for Europe (feature 027) so the sandbox loses its old events.
