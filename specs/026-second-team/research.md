# Research: A Second Team

Decisions for [plan.md](plan.md). Each: Decision, Rationale, Alternatives considered.

## R1 Where team data lives

**Decision**: Two halves, validated together. Structured data lives in a typed module per
team, `src/teams/<id>.ts`: name and install details, default and foreign locale, Rynke rule
history, event kinds, colours and themes, art map, phrase and badge-name mode, dev port, and
the list of placeholders. Scalars that a deploy may change, and everything Wrangler must
see, live in the team's block of `wrangler.jsonc`: `TEAM_ID`, club IDs, season and
qualification dates, feature switches, controller and contact, push subject, plus
resources, domain and crons. Today's vars stay where they are, so tests keep overriding
them as Miniflare bindings. `scripts/team-check.mjs` loads both halves for every
registered team and fails on anything missing (FR-021).

**Rationale**: Wrangler can't read bindings from TypeScript, and rules or art maps don't
fit env strings. Keeping today's vars avoids touching every config reader in Hamburg's
mid-season release.

**Amended 2026-11-09**: Hamburg moved from the top level into its own block,
`env.hamburg`, with its Worker, database, queue and domain unchanged, so every team's
block looks alike. The top level holds no team: its `name` is no team's Worker and its
`main` doesn't exist, so a Wrangler command without `--env` fails instead of deploying
package.json's name (Hamburg's Worker) with no bindings. `team-check` enforces both.

**Alternatives considered**: Everything in env vars (JSON strings): untyped and hard to
review. Everything in TypeScript with a generated `wrangler.jsonc`: the generated file
would be the source Wrangler and CI read, so mistakes move to a build step.

## R2 Selecting the team at runtime

**Decision**: `src/teams/index.ts` exports `TEAMS` (a list) and `teamFor(env)`, which
looks up `env.TEAM_ID` and throws for an unknown ID. `src/index.ts` puts the team on
`Ctx` as `ctx.team`; handlers read `ctx.team`, never `TEAM_ID`. Tests build a `Ctx` with
any team. A Biome/grep test fails if code under `src/` (outside `src/teams/`) contains a
team ID string literal (FR-016).

**Rationale**: One lookup per request, no branching on names, easy to inject in tests.

**Alternatives considered**: A build per team with the team baked in: two bundles to
test and deploy, and data of a third team would mean a third build target.

## R3 Plurals

**Decision**: A catalog value is either a string or a plural object
`{ one?, two?, few?, many?, zero?, other }` keyed by `Intl.LDMLPluralRule`, always
counting by the `n` param. `t()` and `tHtml()` select the form with a per-locale cached
`Intl.PluralRules`. A message is plural when the German source makes it an object; every
other locale must then give an object holding exactly the categories its own
`PluralRules.resolvedOptions().pluralCategories` lists (test). Existing pairs such as
`badges.reveal.one`/`badges.reveal.many` become one plural message. Numbers followed by a
unit that doesn't inflect (Rynke, km, ×) stay plain strings.

**Rationale**: Lithuanian (one/few/many/other), Icelandic and Finnish inflect after
numbers, and the current `.one/.many` key pairs can't express that. `Intl.PluralRules`
ships with the Workers runtime; no library is needed (Principle IV).

**Alternatives considered**: ICU MessageFormat strings with a parser library: rejected by
the constitution's catalog rule. Per-category keys (`id.few`): every locale would carry
keys its grammar doesn't use, and the key type comes from German.

## R4 Locale resolution and Norwegian

**Decision**: Order as today: the `rp_lang` cookie, then the best shipped Accept-Language
range, then the team's `foreignLocale` when the browser names only unshipped languages,
then the team's `defaultLocale` when it names none. Hamburg: `de`/`en` (today's
behaviour); Europe: `en`/`en`. `no` and `nn` ranges resolve to `nb`. The service worker's
`lang` check accepts the shipped codes, not any two letters.

**Rationale**: Keeps Hamburg byte-identical (FR-020), and Norwegian browsers commonly send
`no` or `nn`. The spec's FR-027 is reworded to name both settings.

**Alternatives considered**: Falling back to the team default for unshipped languages
too: a Spanish browser on Hamburg's site would switch from English to German, which is a
visible change in release 1.

## R5 The language picker with ten languages

**Decision**: The switcher becomes a list of native language names (`meta.languageName`),
sorted alphabetically by that name, with the current language marked, using the same menu
pattern as the theme menu, in the same place as today. The mockup is built in the real
fake-mode page at phone and desktop width before implementation, and checked against any
design draft the maintainer links.

**Rationale**: Ten buttons don't fit the top bar on a phone; native names let a rider find
their language without reading the current one.

**Alternatives considered**: Flags: languages aren't countries (Canada, Switzerland, the
UK). A native `<select>`: inconsistent with the app's Material 3 controls (feature 022).

## R6 Consent and privacy in ten languages

**Decision**: Consent and privacy text are catalog messages like the rest, translated with
the same content. A translation doesn't change the consent version (Principle I: only a
change of content is a revision). Every non-English consent and privacy page shows one
sentence saying the English text applies where a translation differs, linking to it.
Each team's controller and contact come from team data.

**Rationale**: FR-028 and the constitution (v2.5.0): no native-speaker review, English is
the reference.

**Alternatives considered**: Consent only in German and English: rejected by the
maintainer.

## R7 Phrase sets: own vs common

**Decision**: `TeamData.phrases` is `{ kind: "own", locale, set }` or `{ kind: "common" }`.
A phrase set is today's shape: `push`, `onTrack`, `seasonPush[season]`,
`seasonOnTrack[season]`. Hamburg's set moves unchanged from
`src/i18n/messages/quotes.de.ts` to `src/content/phrases/hamburg.de.ts`. The common set
exists once per shipped locale in `src/content/phrases/common.<locale>.ts`, each with the
same lists and counts: about 40 phrases, about 26 push and 6 on track, and per season at
least one push and one on-track phrase. The Team page picks the set via
`phraseSet(team, locale)`. Seen phrases keep their text-hash IDs, so Hamburg riders keep
their seen state; a rider switching language sees that language's set fresh.

**Rationale**: One rule covers both teams and any later team. Same lists per language
keep every season covered (FR-045).

**Alternatives considered**: Common phrases in the catalogs as numbered keys: 40 keys in
every catalog for content that isn't UI text, and the key type would come from German,
which has no common set of its own beyond the German adaptation.

## R8 Badge names

**Decision**: `TeamData.badgeNames` is `{ kind: "own", locale, names }` or
`{ kind: "common" }`. Hamburg's German names move to
`src/content/badge-names/hamburg.de.ts` (own). Common names are catalog messages
`badge.name.<id>` in all ten catalogs, since they are short UI labels per language.
`badgeName(ctx.team, i18n, id)` is the one lookup, used by the badges section, the PWA
badge notification and the season album. Rendering problems with long names are issue
#261, not this feature.

**Rationale**: Mirrors R7 (FR-052) and keeps one lookup for three callers.

**Alternatives considered**: Translating Hamburg's names: rejected; they are Hamburg's own.

## R9 Gateway shape

**Decision**: A Worker in `gateway/` on a subdomain of the founding team's domain (e.g.
`gateway.trhh-rynke-coins.link`), with its own queue and no D1. Routes:

- `GET /strava/webhook/<token>`: Strava's subscription check (hub challenge).
- `POST /strava/webhook/<token>`: validate the shape, `sendBatch` one message per team,
  answer 200. Nothing else happens before the answer.
- `GET /auth/return/<teamId>`: 302 to `<team origin>/auth/callback` with `code`, `state`,
  `scope` and `error` copied, for team IDs in its `TEAMS` list only; 404 otherwise.

The queue consumer POSTs each message's event to that team's existing
`/strava/webhook/<team token>` and retries on a non-2xx answer or a network error, with
backoff, per message, so one team doesn't hold up another. Gateway secrets: the Strava
verify token, and one webhook token per team. It logs team ID, status and attempt only.

Team side: a new var `STRAVA_RETURN_VIA` (empty means the team's own origin, as today)
builds `redirect_uri` as `<via>/auth/return/<teamId>`. Teams keep accepting events
directly. So the gateway can go first, teams switch their return setting next, and the
subscription moves last, in any mix of versions (FR-037).

**Rationale**: Strava matches callback domains including subdomains, so a gateway
subdomain needs no change to the Strava app; this is checked once by hand before the
switch (quickstart). Fan-out at ack time gives independent retries for free.

**Alternatives considered**: The gateway on a path of Hamburg's domain via a Workers route:
Hamburg uses a Custom Domain, and mixing a route on the same hostname is fragile. Service
bindings: same-account only, which the spec wants to avoid relying on.

## R10 Local dev orchestration

**Decision**: `scripts/dev.mjs [team…]` (Node, no new dependency) applies each team's
local migrations, then spawns one `wrangler dev dev/worker.ts` per team with
`--env <team>` (none for Hamburg), `--port`, `--host localhost:<port>`, `--inspector-port`
and `--persist-to .wrangler/fake-state-<team>`. Output lines are prefixed `[hamburg]`.
Ctrl+C stops the whole group, and a team that exits stops the others with its exit code.
Ports come from team data: Hamburg 8789, Europe 8790; release 3 adds gateway 8791 and
fake Strava 8792. The test server keeps 8797, inspectors 9230+.
`pnpm dev:<team>` is one line per team in `package.json` calling the script.

Release 3: the fake Strava moves out of the team process into
`dev/fake-strava-worker.ts`. Each team's dev wrapper forwards `www.strava.com` requests to
it, and it sends webhook events to the local gateway. `pnpm dev` then runs fake Strava,
gateway and all teams; `pnpm dev:<team>` keeps the in-process fake for one team alone.

**Rationale**: Wrangler's `dev.port` is top-level only, so ports must be flags; separate
processes match production's separate Workers.

**Alternatives considered**: One `wrangler dev` with several `-c` configs: shares one port
range and doesn't model separate domains, which cookies and redirects need.

## R11 Tests across teams

**Decision**: The existing Vitest suites keep running as Hamburg. A new
`test/teams/**` suite runs as a Vitest project per registered team (bindings from that
team's Wrangler block). It covers data completeness, every rider page rendering in every
locale, that no page names another team or references its art (SC-001), the phrase and
badge-name rules, and recomputing the synthetic season. Playwright adds a Europe smoke
project on port 8798.

**Rationale**: Doubling the full suite doubles CI time for little gain. The differences
between teams are data, so a focused suite over every team catches what matters
(FR-021).

**Alternatives considered**: Running the full suite per team: slow, and most tests don't
depend on team data.

## R12 Database

**Decision**: No schema change. Each team's D1 has today's schema and migrations;
`TEAM_ID` already labels usage records (025).

**Rationale**: Separate databases make team columns unnecessary.

## R13 Deployment per team

**Decision**: CI's `deploy` becomes a matrix over teams (`fail-fast: false`). Each entry
has its own GitHub environment (`production` for Hamburg, `production-europe`), its own
deploy-gate check against that environment's live commit, `team-check --deployable
<team>` (refuses placeholders, FR-053), D1 migrations, then `wrangler deploy --env`. A
separate `deploy-gateway` job deploys `gateway/` when it changed. Europe's entry is added
in release 4. None of these are required-check contexts.

**Rationale**: FR-035 and FR-036; a failed team is re-runnable alone from the matrix.

**Alternatives considered**: Sequential steps in one job: one failure stops the rest.

## R14 Art and install details per team

**Decision**: Assets stay one `public/` folder. Team-specific art lives under
`public/teams/<id>/` and is referenced only through team data (coin sprite, icons,
manifest name and colours, badge pictures). The founding team's data lists its
team-specific badge art. Another team's art map gives its own picture or `placeholder`,
which renders `public/badges/placeholder.svg`. Europe's coin comes from
`art/coin/europe/`.

**Rationale**: A shared folder means one deploy artifact per team without a build step;
FR-023 is about what pages show, and no page references another team's files.

**Alternatives considered**: A composed assets folder per team at build time: cleaner
isolation, but a build step before every `wrangler dev` and deploy.

## R15 Rules per team

**Decision**: `RULES_HISTORY` moves from `src/rynke/rules.ts` into team data as
`team.rules`. Rule functions take the history as an argument. Europe starts with a copy
of Hamburg's history, listed as a placeholder. Europe's `docs/rynke-punkte.md`
counterpart is written in release 4 from its real values.

**Rationale**: FR-019 and SC-002: same functions, data from the team.

## R16 Translation workflow

**Decision**: The maintainers translate from `en.ts` (the reference) with AI help into
each catalog, keeping a glossary of terms that stay as they are (Rynke, Training Rynke,
Team Rynke, Breakaway, Strava's own terms). Checks: every key present, the same
placeholders, the same markup in `tHtml` messages, and the plural categories per R3.
Common phrases follow the content process (US6). The English original is adapted from
Hamburg's list plus new ones, rated, then adapted per language.

**Rationale**: FR-026–FR-028 without native review; checks catch mechanical breakage
that review would otherwise catch.
