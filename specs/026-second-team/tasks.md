# Tasks: A Second Team

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: test-first (constitution Principle V). Each test task comes before the code
that makes it pass, and fails until then. Tests never call Strava or Cloudflare. Fixtures
are synthetic. Run targeted tests locally; CI runs the full suites. The content rating
tool (US6) is manual tooling and gets no tests. UI checks after a deploy happen on the
live site and get no tasks.

**Organization**: four releases (plan.md › Releases), each ending in a checkpoint that can
be merged and deployed on its own. Within a release, tasks are grouped by user story.

Format: `[ID] [P?] [Story] Description`.

---

## Phase 1: Setup

- [X] T001 Amend `.specify/memory/constitution.md` to 2.5.0: per-team default languages,
  every locale on every site, English as reference wording, own content sets may stay in
  one language, Strava brand assets in the rider's language where Strava provides one.
- [X] T002 [US6] Recover the quote rating tool (local `server.mjs`, `index.html`,
  `apply.mjs`, used for the German phrases in October 2026) from the maintainer's local
  session history by replaying its Write and Edit calls. Commit it
  as `tools/content-rating/`, with no rider data and votes stored only under a git-ignored
  `tools/content-rating/rounds/`, and add `tools/content-rating/README.md` with how to run
  a round (FR-029–FR-034). Not under `src/`; `test/unit/dev-guard.test.ts` gets
  `tools/` added to the folders `src/` must not import.
- [X] T003 [US6] Brief `content/briefs/common-phrases.md`: tone "light, mostly neutral",
  target "about 40, about 26 push, 6 on track, per season at least one push and one
  on-track", no team, place, charity, rider name, rank or comparison, the source "adapted
  from Hamburg's list in `src/i18n/messages/quotes.de.ts`, some new ones" (FR-029, FR-046,
  FR-047).

---

# Release 1: Languages and phrase rule

Visible to Hamburg: ten languages in the picker. Nothing else changes.

## Phase 2: Foundation (release 1)

Blocks every release 1 story.

- [X] T004 Tests in `test/unit/i18n.test.ts` for plural messages (contracts/locales.md ›
  Message values): `t()` and `tHtml()` select by `Intl.PluralRules(meta.intlLocale)` from
  the `n` param, a plural message without a numeric `n` throws, string messages behave as
  today.
- [X] T005 Plural support in `src/i18n/i18n.ts` and the `MessageValue` type in
  `src/i18n/catalogs.ts`: `string | PluralMessage`, where `PluralMessage = { other: string }
  & Partial<Record<"zero"|"one"|"two"|"few"|"many", string>>`, with `Intl.PluralRules`
  cached per locale (research R3). T004 green.
- [X] T006 Turn the existing one/many key pairs (e.g. `badges.reveal.one` /
  `badges.reveal.many`) and the count messages whose noun inflects (e.g.
  `fetching.import`) into plural messages in `src/i18n/messages/de.ts` and `en.ts`, and
  update their callers to pass `n`. Leave messages whose unit doesn't inflect (Rynke, km,
  ×) as strings. Existing tests stay green with unchanged German and English output.
- [X] T007 Tests in `test/unit/catalogs.test.ts` (contracts/locales.md › Checks 1–5):
  every catalog has exactly the `de` keys, the same placeholders, the same SafeHtml
  placeholders, a message is plural in a locale iff it is plural in `de` with exactly that
  locale's `pluralCategories`, no value is empty or equals its key. Iterates over
  `CATALOGS`, so it covers each new locale as it's added.
- [X] T008 Minimal team seam in `src/teams/types.ts`, `src/teams/hamburg.ts` and
  `src/teams/index.ts`: `TeamData` with only `id`, `defaultLocale`, `foreignLocale`,
  `phrases` and `badgeNames` for now (data-model.md), `TEAMS = [hamburg]`, and
  `teamFor(env)` throwing `Unknown TEAM_ID "<x>"`. Put `team` on `Ctx` in `src/ctx.ts`,
  set it in `src/index.ts` and `dev/worker.ts`, and in `test/support/ctx.ts`.
- [X] T009 Tests in `test/unit/resolve.test.ts` (contracts/locales.md › Resolution): the
  cookie wins, then the best shipped range, `no` and `nn` count as `nb`, only unshipped
  ranges give `team.foreignLocale`, no ranges give `team.defaultLocale`; for Hamburg the
  results equal today's.
- [X] T010 `resolveLocale(request, catalogs, team)` in `src/i18n/resolve.ts`, with
  `DEFAULT_LOCALE`/`FOREIGN_LOCALE` replaced by the team's fields at the call sites
  `src/http/router.ts`, `src/http/fetching.ts`, `src/http/pwa.ts`. `de` stays the key
  source and fallback catalog in `src/i18n/i18n.ts`. T009 green.

**Checkpoint**: plurals, catalog checks and team-aware resolution in place; output unchanged.

## Phase 3: User Story 5 – Every rider's language (P2, release 1)

**Goal**: every page, consent and privacy included, in all ten languages, on every site.

**Independent test**: switch a synthetic rider through all ten languages on every page
(quickstart › Release 1 steps 1, 2, 4, 5).

- [X] T011 [US5] Tests in `test/integration/lang.test.ts`: `POST /lang` accepts each of
  the ten codes and refuses others; the picker lists ten native names, alphabetically,
  current one marked (contracts/locales.md › Picker).
- [X] T012 [US5] Mock-up of the ten-language picker inside the real fake-mode pages at phone
  and desktop width (research R5), following the theme menu in `src/http/theme-menu.ts`,
  for the maintainer to approve before T013.
- [X] T013 [US5] The picker in `src/http/lang.ts`, `src/http/shell.ts` and
  `src/http/style.ts` as approved in T012. T011 green.
- [X] T014 [US5] `public/sw.js`: accept `lang` only from the shipped list (written into
  the worker's URL by the page), else the team default the page passes. Test in
  `test/integration/pwa.test.ts` for `nb` and an unknown code.
- [X] T015 [US5] Reference note: `consent.referenceNote` (with a link to the English page)
  in `de.ts` and `en.ts`, shown on consent and privacy pages in every locale but `en`, in
  `src/http/landing.ts`, `src/http/consent-form.ts` and `src/http/privacy.ts`; `?lang=en`
  renders that one page in English without setting `rp_lang` (contracts/locales.md ›
  Reference note). Test in `test/integration/privacy.test.ts`.
- [X] T016 [US5] Glossary `src/i18n/GLOSSARY.md`: terms that stay as they are (Rynke,
  Training Rynke, Team Rynke, Breakaway, Strava's own terms) and per-language notes (formal
  or informal address: informal in every language, as in German) (research R16).
- [X] T017 [P] [US5] Danish catalog `src/i18n/messages/da.ts` translated from `en.ts`
  (reference) per the glossary; `meta.languageName` "Dansk", `meta.intlLocale` "da-DK";
  registered in `src/i18n/catalogs.ts`. T007 green for `da`.
- [X] T018 [P] [US5] Norwegian Bokmål `src/i18n/messages/nb.ts`, "Norsk bokmål", "nb-NO".
- [X] T019 [P] [US5] Swedish `src/i18n/messages/sv.ts`, "Svenska", "sv-SE".
- [X] T020 [P] [US5] Finnish `src/i18n/messages/fi.ts`, "Suomi", "fi-FI".
- [X] T021 [P] [US5] Icelandic `src/i18n/messages/is.ts`, "Íslenska", "is-IS".
- [X] T022 [P] [US5] French `src/i18n/messages/fr.ts`, "Français", "fr-FR".
- [X] T023 [P] [US5] Dutch `src/i18n/messages/nl.ts`, "Nederlands", "nl-NL".
- [X] T024 [P] [US5] Lithuanian `src/i18n/messages/lt.ts`, "Lietuvių", "lt-LT", with
  one/few/many/other plural forms.
- [X] T025 [US5] Strava brand assets: if Strava's brand download offers the "Connect with
  Strava" button and "Powered by Strava" logo in any of the new languages, add them
  unmodified under `public/strava/<lang>/` and pick by locale with English as fallback in
  the code that references `public/strava/en/`; record the source in
  `public/strava/README.md`.
- [X] T026 [US5] Test in `test/integration/all-locales.test.ts`: every rider page and the
  consent, privacy, offline and notification-text routes render with `rp_lang` set to each
  shipped locale, without throwing, and contain that catalog's `meta.languageName` in the
  picker. `test/integration/no-hardcoded-copy.test.ts` keeps passing.

## Phase 4: User Story 4 (part) – The phrase rule and badge names (P2, release 1)

**Goal**: own vs common phrases and badge names (FR-025, FR-045–FR-047, FR-052). Hamburg
unchanged in every language.

**Independent test**: Hamburg's Team page in every locale shows only Hamburg's German
phrases and badge names (quickstart › Release 1 step 3); a test team set to `common` gets
the rider's language.

- [X] T027 [US4] Move `src/i18n/messages/quotes.de.ts` to
  `src/content/phrases/hamburg.de.ts` and `src/i18n/messages/badges.de.ts` to
  `src/content/badge-names/hamburg.de.ts` without changing a phrase or name; reshape into
  `PhraseSet` (`push`, `onTrack`, `seasonPush`, `seasonOnTrack`) in
  `src/content/types.ts`; update imports in `src/http/sections/team.ts`,
  `src/http/sections/badges.ts`, `src/http/pwa.ts`, `album/render.ts` and the tests.
  Seen-phrase IDs stay the same (they hash the text).
- [X] T028 [US4] Tests in `test/unit/phrases.test.ts` (contracts/phrases.md › Checks): every
  `common.<locale>.ts` has the same list lengths as `common.en.ts`; no duplicates within a
  list; no phrase longer than Hamburg's longest; the existing quote rules from
  `test/unit/quotes.test.ts` run over every set; common sets contain none of `Hamburg`,
  `Rynkeby`, `Paris` or any registered team name.
- [X] T029 [US4] Tests in `test/integration/phrase-rule.test.ts`: for Hamburg
  (`phrases.kind: "own"`), the Team page in each locale shows only phrases from
  `hamburg.de.ts` and German badge names; for a test team with `kind: "common"` built in
  the test, locale X shows only phrases from `common.X.ts` and badge names from
  `badge.name.<id>` in X.
- [X] T030 [US4] `phraseSet(team, locale)` and `badgeName(team, i18n, id)` in
  `src/content/index.ts` as the only entry points (contracts/phrases.md › Lookups); Hamburg's
  data sets `phrases: { kind: "own", locale: "de", set }` and
  `badgeNames: { kind: "own", locale: "de", names }` in `src/teams/hamburg.ts`; callers in
  `src/http/sections/team.ts`, `src/http/sections/badges.ts`, `src/http/pwa.ts` and
  `album/render.ts` use them. T029 green.
- [X] T031 [US6] Rating round for the English original: generate about three times the
  target from the brief T003 (adapting Hamburg's phrases plus new ones), remove
  near-duplicates and rule breakers, rate with the tool from T002, repeat for the
  shortfall. Write the approved set to `src/content/phrases/common.en.ts`.
- ~~T032–T034~~ Shelved 2026-11-09 (FR-025): the common phrases stay English in every
  language, the stand-in for a team without phrases of its own. They were `common.de.ts`,
  then the other eight languages, each adapted from `common.en.ts` index by index.
- [X] T035 [US4] Common badge names `badge.name.<BadgeId>` for every badge in
  `src/badges/catalog.ts`, in all ten catalogs (English first, then adapted; German may
  differ from Hamburg's own names). T007 green.

**Checkpoint (release 1)**: merge and deploy. Hamburg shows ten languages; its monkey and
badge names stay German.

---

# Release 2: Team data and dev commands

Visible to Hamburg: nothing (SC-002).

## Phase 5: Foundation (release 2)

- [X] T036 Snapshot test `test/teams/season-snapshot.test.ts`: recalculate the synthetic
  sample season (dev samples) with today's code and store Rynke, badges and the rider and
  Team page texts as a committed snapshot, before any move (SC-002). It must stay
  identical through release 2.
- [X] T037 Full `TeamData` in `src/teams/types.ts` per data-model.md: `id` "`[a-z]+`,
  equals `TEAM_ID`, unique in `TEAMS`", `name`, `shortName`, `defaultLocale`,
  `foreignLocale`, `rules` "non-empty, ordered by `from` date", `eventKinds`, `colours`,
  `art` (ArtMap), `phrases`, `badgeNames`, `otherClubIds`, `dev` `{ host, port,
  inspectorPort }` "ports distinct across teams, never 8797/9237; host `localhost` for the
  founding team, `<id>.localhost` otherwise", `placeholders`.
- [X] T038 Fill `src/teams/hamburg.ts` with today's values, moved: `RULES_HISTORY` from
  `src/rynke/rules.ts` (R15), event kinds, colours and themes from `src/http/themes.ts`,
  coin and icons from `src/http/coin.ts` and `src/http/pwa.ts`, `teamSpecificBadges`
  listing the badges with Hamburg motifs (check each picture in `art/badges/`), dev
  `{ host: "localhost", port: 8789, inspectorPort: 9230 }`, `placeholders: []`.
- [X] T039 `src/teams/europe.ts`: name "Team Rynkeby Europe", `defaultLocale` and
  `foreignLocale` `en`, `phrases` and `badgeNames` `{ kind: "common" }`, coin from
  `art/coin/europe/` copied to `public/teams/europe/`, badge map with `"placeholder"` for
  every Hamburg `teamSpecificBadges` entry, everything else copied from Hamburg; dev
  `{ host: "europe.localhost", port: 8790, inspectorPort: 9231 }`; `placeholders` listing
  every copied field (FR-053). Register in `src/teams/index.ts`.
- [X] T039a Fill Hamburg's `teamSpecificBadges` after the user reviews `art/badges/`, then
  add placeholder entries to Europe's badge map. (T038 left the list empty, pending that
  review.) From the scenes in `badges.json`: `distance-1000` (Elbphilharmonie),
  `running-100` and `team-running-1000` (harbour crane); Europe's map follows the list.
- [X] T040 `env.europe` block in `wrangler.jsonc`: Worker name `rynke-points-europe`,
  its own D1 `rynke-points-europe` and queue `rynke-points-europe-work` with placeholder
  IDs, the same crons, every var from the top-level block with Europe's values
  (`TEAM_ID` "europe"; placeholder club IDs, dates, controller and contact), no routes yet.
  Run `pnpm types`.
- [X] T041 `scripts/team-check.mjs` (contracts/team-data.md): load every team's TS data and
  Wrangler block, fail with one line per problem (missing field or var, duplicate ID or
  port, unsorted rules, missing art path, a Hamburg-specific badge without an entry in
  another team's map, an own set referenced by another team); `--deployable <id>` also
  fails while `placeholders` is non-empty, naming them. Add it to `pnpm lint` in
  `package.json`.
- [X] T042 Test in `test/unit/no-team-names.test.ts`: no file under `src/` outside
  `src/teams/` contains a registered team ID or name as a string literal (FR-016).
- [X] T043 Vitest project per registered team for `test/teams/**` in `vitest.config.ts`
  (bindings from that team's Wrangler block, research R11); existing suites stay Hamburg.

## Phase 6: User Story 3 – Own rules and season (P1, release 2)

**Goal**: rules, season and switches from team data; no code names a team.

**Independent test**: team suite green for both teams; the snapshot T036 unchanged.

- [X] T044 [US3] Tests in `test/teams/rules.test.ts`: the same synthetic ride scored with
  two teams' different rules gives each team's own result; changing one team's rules leaves
  the other's results unchanged (US3 scenarios 1, 2).
- [X] T045 [US3] Rule functions in `src/rynke/` take the rule history as an argument;
  callers pass `ctx.team.rules`. T044 and T036 green.
- [X] T046 [US3] Tests in `test/teams/switches.test.ts` for `BADGES`, `PHRASES`,
  `SEASON_ALBUM`, `FUN_THEMES` set to `"off"`: no page, menu entry, text, notification or
  scheduled work for the feature (US3 scenario 3, FR-018).
- [X] T047 [US3] The four switches as vars (`"on"` or `"off"`, default `"on"`) in
  `wrangler.jsonc` for both teams, readers in `src/config.ts`, and the checks in the
  badges section, Team section phrases, scheduled badge work, the album, and theme menu.
  T046 green.
- [X] T048 [US3] Test in `test/teams/completeness.test.ts`: `team-check` fails and names
  the field for a team with a missing field (US3 scenario 4).

## Phase 7: User Story 4 – A team looks like itself (P2, release 2)

**Goal**: name, icon, coin, colours, badges and phrases per team; nothing of Hamburg on
Europe's site.

**Independent test**: quickstart › Release 2 step 1; no page of Europe contains Hamburg's
name or art paths.

- [X] T049 [US4] Test in `test/teams/no-other-team.test.ts` (SC-001): render every rider,
  organiser and admin page, the manifest, notification texts and the offline page for each
  team; none contains another team's name, a path under another team's
  `public/teams/<id>/`, or another team's `teamSpecificBadges` art.
- [X] T050 [US4] Name, short name, icons and colours in the manifest and shell from
  `ctx.team` in `src/http/pwa.ts`, `src/http/shell.ts`, `src/http/themes.ts`; coin sprite
  from `ctx.team.art.coin` in `src/http/coin.ts`. The four catalog messages naming the
  team take its name as a param, and `PENDING` in `test/unit/no-team-names.test.ts`
  becomes empty.
- [X] T051 [US4] Badge pictures through `ctx.team.art.badges`, with `"placeholder"`
  rendering a new neutral `public/badges/placeholder.svg`, in `src/badges/pictures.ts`;
  add the placeholder to `scripts/art-versions.mjs`. T049 green.
- [X] T052 [US4] Any catalog message naming Hamburg or the team takes the name from
  `ctx.team.name` as a param instead, in all ten catalogs and their callers.

## Phase 8: User Story 8 – Develop with every team locally (P2, release 2)

**Goal**: `pnpm dev:<team>` and `pnpm dev` (contracts/dev-commands.md).

**Independent test**: quickstart › Release 2 steps 3, 4.

- [X] T053 [P] [US8] Synthetic Europe riders `dev/fake-strava/samples.europe.ts`: names
  from Denmark, Norway, Sweden, Finland, Iceland, Germany, France, the Netherlands,
  Lithuania, the UK and Canada, all invented (FR-050); Hamburg's samples move to
  `dev/fake-strava/samples.hamburg.ts`; `dev/fake-strava/seed.ts` picks by `ctx.team.id`.
- [X] T054 [US8] `dev/worker.ts`: the local-host guard accepts `*.localhost`; seeding and
  sample choice follow `ctx.team`.
- [X] T055 [US8] `scripts/dev.mjs` (contracts/dev-commands.md): per team apply migrations
  into `.wrangler/fake-state-<id>`, spawn `wrangler dev` with `[--env <id>]`, the team's
  host, port and inspector port and today's fake-mode flags and unset secrets; prefix lines
  `[<id>]`; print `<id> → http://<host>:<port>` once started; stop every child on Ctrl+C,
  SIGTERM or one child's non-zero exit, and exit with its code; refuse to start when a
  port is taken, naming port and team.
- [X] T056 [US8] `package.json`: `"dev": "node scripts/dev.mjs"`,
  `"dev:hamburg": "node scripts/dev.mjs hamburg"`,
  `"dev:europe": "node scripts/dev.mjs europe"`; `dev:strava` unchanged. Update
  `CLAUDE.md` › Commands and the local-dev quickstart in `specs/006-local-frontend-dev/`.
- [X] T057 [US8] Playwright project `europe-smoke` in `playwright.config.ts` with its own
  server on port 8798 (inspector 9238) via a `test:e2e:server:europe` script, and
  `e2e/europe-smoke.e2e.ts`: Europe's name, English by default, a common phrase on the Team
  page, the placeholder badge picture, no Hamburg text.

**Checkpoint (release 2)**: merge and deploy (Hamburg only). Snapshot T036 unchanged.

---

# Release 3: Gateway

Visible to Hamburg: nothing; sign-ins pass the gateway.

## Phase 9: User Story 2 – Rides reach the right team (P1, release 3)

**Goal**: one webhook receiver fanning out to every team, with independent retries.

**Independent test**: quickstart › Release 3 steps 2, 3.

- [X] T058 [US2] `gateway/wrangler.jsonc`: Worker `rynke-points-gateway`, queue
  `rynke-points-gateway-forward` (producer `FORWARD_QUEUE` and consumer, `max_retries`
  high, low `max_concurrency`), var `TEAMS` "JSON list of `{ id, origin }`; ids unique,
  origins `https:` (local: `http://<host>:<port>`)", secrets `STRAVA_WEBHOOK_VERIFY_TOKEN`
  and `TEAM_WEBHOOK_TOKEN_<ID>`, no D1, no `observability` invocation logs; its own
  `tsconfig` include; `test/unit/dev-guard.test.ts` also forbids `src/` importing
  `gateway/`.
- [X] T059 [US2] Tests in `test/gateway/webhook.test.ts` (contracts/gateway.md › Routes):
  the subscription check answers the challenge for the right token and 403 otherwise; a
  valid POST answers 200 after one `sendBatch` with one message per team; a non-event body
  gives 400; a wrong token 403; nothing is logged but the team ID, status and attempt.
- [X] T060 [US2] `gateway/index.ts` and `gateway/teams.ts`: fetch handler for
  `/strava/webhook/<token>` (GET and POST) and `/health`. T059 green.
- [X] T061 [US2] Tests in `test/gateway/forward.test.ts`: the consumer POSTs each message
  to its team's `/strava/webhook/<token>`; a 2xx acks; a 5xx or a network error retries
  with a growing delay; one team failing doesn't hold another's message.
- [X] T062 [US2] Queue consumer in `gateway/index.ts`. T061 green.
- [X] T063 [US2] Test in `test/integration/webhook.test.ts`: an event forwarded for an
  unknown rider is acked without a Strava request and without storing or logging its IDs
  (FR-010). Adjust `src/http/webhook.ts` and `src/work/consumer.ts` only if it fails.
- [X] T064 [US2] Vitest project for `test/gateway/**` with the gateway's config in
  `vitest.config.ts`.

## Phase 10: User Story 1 – A rider joins their own team (P1, release 3)

**Goal**: Strava sign-in returns through the gateway to the team's own domain.

**Independent test**: quickstart › Release 3 step 1.

- [X] T065 [US1] Tests in `test/gateway/return.test.ts`: `/auth/return/<teamId>` 302s to
  that team's origin `/auth/callback` with `code`, `state`, `scope` and `error` copied and
  nothing else; an unknown team ID gives 404; a forged `Host` or extra params never change
  the target (FR-007, US1 scenario 4).
- [X] T066 [US1] `/auth/return/<teamId>` in `gateway/index.ts`. T065 green.
- [X] T067 [US1] Tests in `test/integration/connect.test.ts` (no `auth.test.ts` exists): with `STRAVA_RETURN_VIA` empty,
  `redirect_uri` is `<own origin>/auth/callback` as today; when set, it is
  `<via>/auth/return/<TEAM_ID>`; the callback's state check is unchanged.
- [X] T068 [US1] `STRAVA_RETURN_VIA` var (empty for every team for now) in
  `wrangler.jsonc`, read in `src/config.ts`, used in `src/http/auth.ts`. T067 green.

## Phase 11: User Story 8 – `pnpm dev` mirrors production (P2, release 3)

- [X] T069 [US8] `dev/fake-strava-worker.ts`: the fake Strava (API, authorize page,
  events, store) as its own local Worker on port 8792 (inspector 9233), sending webhook
  events to the local gateway; `dev/worker.ts` forwards `www.strava.com` requests to it
  when `RYNKE_FAKE_STRAVA_URL` is set, and keeps the in-process fake otherwise.
- [X] T070 [US8] `scripts/dev.mjs` with no team argument also starts the fake Strava
  worker and the gateway (port 8791, inspector 9232, `TEAMS` pointing at the local team
  origins, `STRAVA_RETURN_VIA` set to the local gateway), prefixed `[strava]` and
  `[gateway]` (FR-049). `pnpm dev:<team>` unchanged.
  *Done differently:* the fake Strava stays in each team's Worker (its sample riders and
  rides live in that team's local database); `pnpm dev` runs the gateway, sends riders
  back through it and posts simulated events to its webhook (`RYNKE_FAKE_GATEWAY`).
  Port 8792 stays reserved. contracts/dev-commands.md › Behind the gateway.

## Phase 12: Gateway rollout (release 3)

- [X] T071 Gateway deploy job `deploy-gateway` in `.github/workflows/ci.yml`, run after the
  checks on `main` when `gateway/**` changed, with its own environment; not a required-check
  context.
  Off until the repository variable `GATEWAY_DEPLOY` is `on`, so a merge creates nothing.
- [X] T072 Runbook `docs/gateway-switch.md` for the manual steps (contracts/gateway.md ›
  Switching; quickstart › Release 3 manual steps): custom domain, queue, secrets, setting
  `STRAVA_RETURN_VIA` for Hamburg, checking a real sign-in, moving the subscription,
  setting `STRAVA_SUBSCRIPTION_ID`, the daily run for the gap, and switching back.
- [X] T072a `POST /admin/catch-up?since=<epoch>` (`src/http/catch-up.ts`, tests in
  `test/integration/catch-up.test.ts`) and `pnpm catch-up`: one `reread-page` per
  connected rider since the switch. The daily run doesn't re-read rides, so the plan's
  "daily run for the gap" wouldn't have caught them (FR-011).
- [X] T072b Optional secret `STRAVA_SUBSCRIPTION_ID_OVERRIDE` (`src/config.ts`
  `subscriptionId`, tests in `test/unit/config.test.ts` and
  `test/integration/webhook.test.ts`): it wins over `STRAVA_SUBSCRIPTION_ID` while set, so
  the new subscription's ID goes live with `wrangler secret put` instead of a deploy and
  the switch drops events for about a minute instead of a deploy's length.

**Checkpoint (release 3)**: merge and deploy; the maintainer runs the runbook.

---

# Release 4: Second team live

## Phase 13: User Story 7 – One change, every team (P2, release 4)

**Goal**: one merge deploys every team independently.

**Independent test**: dry run with one team's step failing (US7).

- [X] T073 [US7] Per-team deploy matrix in `.github/workflows/ci.yml` (research R13): the
  `deploy` job over the teams `deploy-gate` selects, with `fail-fast: false`, environment
  `production` for Hamburg and `production-europe` for Europe, the deploy-gate per
  environment, then `node scripts/team-check.mjs --deployable <team>`, D1 migrations with
  `--env`, `wrangler deploy --env` (none for Hamburg). Europe only while the repository
  variable `EUROPE_DEPLOY` is `on`. Job names stay out of `.github/rulesets/*.json`.
- [X] T074 [US7] Europe's sandbox (spec 027) on a subdomain of the founding team's domain:
  its resources in `wrangler.jsonc` and one more checkbox on **Release PR** in
  `.github/workflows/release-pr.yml` (FR-042).
- [X] T075 [US7] Update `.github/repository-settings.md` with the `production-europe`
  environment and its credential (manual, per spec 028).

## Phase 14: User Story 1 – Riders in both clubs (P1, release 4)

- [X] T076 [US1] Tests in `test/integration/one-team.test.ts`: a new rider whose clubs
  include one of `ctx.team.otherClubIds` is connected and sees the one-team-at-a-time
  notice (FR-012); a rider only in this team's club, or reconnecting, doesn't. Strava
  shows a rider's clubs only after the sign-in, so the notice comes right after the first
  connection, before any second one.
- [X] T077 [US1] `clubMembership` in `src/strava/client.ts` reads both answers from the
  same club pages; `/notice/one-team` in `src/http/notice.ts`, reached from
  `src/http/auth.ts`, with `notice.oneTeam.*` and `notice.carryOn` in all ten catalogs.
  T076 green.

## Phase 15: Usage across teams (release 4, FR-039–FR-041)

- [X] T078 Tests in `test/integration/admin-usage-teams.test.ts`: each team's admin view
  shows every team's count and share per figure, unattributed usage apart, the total of
  connected riders against 999; a team that can't be reached shows as unavailable
  without breaking the view; no other team's name on the page (FR-023).
- [X] T079 Usage figures exchange ([contracts/usage-exchange.md](contracts/usage-exchange.md)):
  a read-only, token-protected `GET /admin/usage/export` per team (no rider data), the
  hourly pull into `usage_team_daily` (migration `0027_usage_teams.sql`), `USAGE_PEERS`
  and the optional secret `USAGE_EXCHANGE_TOKEN`, and the merge in
  `src/http/admin/usage.ts`, `src/http/admin/history.ts` and `src/usage/peers.ts`.
  T078 green.
- [X] T080 Alerts of feature 025 go to every team's administrators: connected riders are
  recorded as all teams' together, Strava's and Cloudflare's figures are shared anyway
  (FR-041). Maintainers outside the app are feature 028's (FR-025).
- [X] T080a Cloudflare's figures split by team (FR-040): map Workers, databases and queues
  to teams in team data, count the gateway's as shared, and say so for a figure that
  can't be split, in `src/usage/cloudflare.ts` and the view.

## Phase 16: Go live (release 4)

- [ ] T081 Replace Europe's placeholders with its real values in `src/teams/europe.ts` and
  `wrangler.jsonc` (domain route, club IDs, dates, rules, switches, controller, contact),
  empty `placeholders`; `node scripts/team-check.mjs --deployable europe` passes.
- [X] T082 Europe's Rynke explanation in English, `docs/teams/europe/rynke-points.md`, and its
  PDF `rynke-points.pdf` (not `rynke-punkte`), from its values (FR-022). For now it is an
  English translation of Hamburg's `docs/rynke-punkte.md`, adjusted only where Europe's
  values differ. The handout's file name becomes team data instead of the fixed
  `RULES_HANDOUT_URL` in `src/http/rider-sections.ts`; `scripts/docs-pdf.sh` builds per team.
- [ ] T083 Add Europe to the gateway's `TEAMS` in `gateway/wrangler.jsonc`.
- [X] T084 Runbook `docs/add-a-team.md`: the manual steps from quickstart › Release 4
  (resources in the EU jurisdiction, secrets with the Strava secret by the Strava owner
  only, environment, controllers' decision, gateway token), written for any later team
  (FR-004, FR-043, FR-044).

**Checkpoint (release 4)**: merge; CI deploys both teams; the maintainers check Europe on
its domain.

---

## Phase 17: Polish

- [X] T085 Update `README.md` and `CLAUDE.md` for teams, the gateway, the dev commands and
  the ten languages; add `gateway/` to the non-negotiable import rule in `CLAUDE.md`.
- [X] T086 Remove the dead `DEFAULT_LOCALE` and `FOREIGN_LOCALE` exports once nothing uses
  them, in `src/i18n/catalogs.ts`.

---

## Dependencies

- Releases run in order: 1 → 2 → 3 → 4. Each checkpoint is a merge and deploy.
- Release 1: T004–T010 before T011–T035. T002 → T003 → T031. T027 before
  T029–T030. T017–T024 each need T007 and T016.
- Release 2: T036 first (snapshot before any move). T037 → T038 → T039 → T040 → T041.
  T043 before the `test/teams/` tests. US3, US4 and US8 phases can then run side by side.
- Release 3: T058 → T059 → T060 → T061 → T062; T065–T068 need T058. T069 → T070 need
  T060 and T066.
- Release 4: T073 needs T041. T081 needs Europe's values. T083 needs T081.

## Parallel examples

- Release 1: T017–T024 (one catalog each) in parallel.
- Release 2: T053 alongside T044–T052.
- Release 3: T059 (webhook tests) and T065 (return tests) in parallel after T058.

## Implementation strategy

Ship release 1 first. It's useful on its own (riders of any nationality on Hamburg's
site) and settles the catalog and phrase work, the largest content task. Release 2 is a
pure refactor guarded by the snapshot. Release 3 can wait until Europe is close. Release
4 depends on Europe's values.
