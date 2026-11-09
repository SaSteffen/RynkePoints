# Quickstart: A Second Team

How to check each release works. Details: [contracts/](contracts/) and
[data-model.md](data-model.md). UI checks after a deploy happen on the live site.

## Release 1: Languages and phrase rule

```bash
pnpm test -- test/unit/i18n.test.ts test/unit/quotes.test.ts test/unit/badge-names.test.ts
pnpm dev:hamburg        # before release 2 exists: pnpm dev
```

1. Open `http://localhost:8789`, open the language picker: ten languages by native name.
2. Pick each language. Every page is in it, incl. consent and privacy; non-English
   consent/privacy pages show the English-reference note.
3. On the Team page in any language: the monkey speaks Hamburg's German phrases; badge
   names are German.
4. With a browser set to `es` only: English (as today). With no language: German.
5. Lithuanian: `1 …`, `2 …`, `10 …` show the right plural forms (R3).

## Release 2: Team data and dev commands

```bash
node scripts/team-check.mjs                       # passes, lists no errors
node scripts/team-check.mjs --deployable europe   # fails, names Europe's placeholders
pnpm dev:europe                                    # europe → http://europe.localhost:8790
pnpm dev                                           # both, prefixed output
```

1. Europe's site: Europe's name, icon, coin and colours; English by default; the monkey
   speaks the English common phrases, and in French the French ones; Hamburg-motif badges
   show the placeholder picture.
2. Hamburg's site: unchanged from before the release.
3. Sign in on Hamburg's site, open Europe's: not signed in, no Hamburg rider visible.
4. Ctrl+C stops both.
5. `pnpm test` includes the team suite for both teams; the synthetic season matches the
   pre-release results (SC-002).

## Release 3: Gateway

```bash
pnpm dev     # [strava] [gateway] [hamburg] [europe]
```

1. Connect a synthetic rider on each team's site: the fake Strava's approval returns via
   `localhost:8791/auth/return/<team>` to the team's own site.
2. Simulate a ride event for a Hamburg rider in the fake Strava: it reaches Hamburg; Europe
   drops it without a Strava call.
3. Retries: `pnpm dev` stops every process when one stops, so this is covered by
   `test/gateway/forward.test.ts` (a team down retries with a growing delay; the other
   team's message is acked).

Manual steps (Strava owner and maintainers):

Runbook: [docs/gateway-switch.md](../../docs/gateway-switch.md).

1. Create the gateway's custom domain, queue and secrets; deploy it.
2. Set `STRAVA_RETURN_VIA` for Hamburg; deploy; check a real sign-in round trip.
3. Switch the subscription as in [contracts/gateway.md](contracts/gateway.md) › Switching.
4. Watch the admin view and logs for a day: events reach Hamburg, none fail.

## Release 4: Second team live

Manual steps before the deploy:

1. Europe sends its values: domain, clubs, dates, Rynke values, default language,
   switches, controller and contact, art direction, phrase rater.
2. Replace the placeholders and empty `placeholders`; `team-check --deployable europe`
   passes.
3. Create Europe's D1 (EU jurisdiction), queue, custom domain, secrets (Strava secret: the
   Strava owner only, FR-043), GitHub environment `production-europe`, sandbox.
4. Each affected controller records the access decision (FR-044).
5. Add Europe to the gateway's `TEAMS` and its webhook token; deploy the gateway.

After the merge: CI deploys Hamburg and Europe as separate matrix entries. Check Europe's
domain end to end with a real rider of its club. Check that a rider of both clubs sees the
one-team-at-a-time notice.
