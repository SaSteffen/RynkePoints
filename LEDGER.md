# Gap ledger

Review of code, specs and docs after the changes of 2026-10-29 to 2026-11-12
(second team, sandboxes, gateway, badge sharing, badge hints, seasonal monkeys, ride
stats, rider summaries, organiser graphs, multiple maintainers, Sponsoring-Rynke).
Each row is a proposal; **Decision** is for the owner (yes / no / later).

Priority: **P1** blocks something planned or affects riders now · **P2** should happen
before the next release or season · **P3** housekeeping.

## Unfinished features

| ID | Pri | Area | Gap | Proposal | Decision |
|---|---|---|---|---|---|
| G01 | P1 | Second team – go live | Europe still runs on placeholders: club IDs, season start, qualification deadline, privacy controller, contact, short name, colours, icons, database ID (`src/teams/europe.ts` `placeholders`; tasks T081). `team-check --deployable europe` refuses a production deploy until then. | Collect the values from Team Europe in one list (issue #236) and close T081 in one PR. | |
| G02 | P1 | Second team – gateway | The Strava gateway's `TEAMS` only names Hamburg (`gateway/wrangler.jsonc`, T083), and its required secrets only `TEAM_WEBHOOK_TOKEN_HAMBURG`. Europe's riders' webhooks would not be forwarded. | Add Europe and `TEAM_WEBHOOK_TOKEN_EUROPE` together with G01; the secret is a manual step for the owner. | |
| G03 | P1 | Sandboxes – release gate | Slice 2 (the `sandbox-gate` check, control comment, **Accept**) is entirely open: T039–T059, 21 tasks. Multiple maintainers' table already relies on "Accept on the sandbox gate". | Decide whether slice 2 is still wanted. If yes, implement as planned; if no, cut it from the sandboxes spec and the maintainers spec. | |
| G04 | P2 | Multiple maintainers | Spec and plan exist, but no `tasks.md` and nothing implemented: no organization move, no CODEOWNERS, docs still say "the maintainer" (README 3×, `.github/repository-settings.md` 4×, rulesets README, `ci.yml`, `release-pr.yml`). | Run `/speckit.tasks` for it, or park it with a status line in the spec saying it waits for a second maintainer. | |
| G05 | P2 | Sponsoring-Rynke | Spec and mockups only; no plan, tasks or code. Its season is 1 Sep–31 Aug, so it needs to be live by 1 Sep 2027 at the latest. | Plan it after the second team is live; set a target release. | |
| G06 | P2 | Rider view – corrections | Riders still don't see organiser corrections on their page: no list, no "+10 from corrections" part in the gauge, no keys `rynke.corrections.*` (rider view T084–T089; gauge part 6 is reserved). The data is read only for progress charts. A rider whose total changes by a correction can't see why. | Finish T084–T089 as specified. | |
| G07 | P2 | Season data cleanup | Still only a backlog prompt (`specs/backlog/season-data-cleanup.md`). The constitution's data minimisation has no answer for last season's rides, attendances, requests and corrections. Needs to be decided before the next rollover (1 Sep 2027), and now for two teams. | Specify it in the winter; include Europe and Sponsoring-Rynke's season. | |

## Spec and docs drift

| ID | Pri | Area | Gap | Proposal | Decision |
|---|---|---|---|---|---|
| G17 | P2 | Constitution – languages | The constitution's Language section says content shared by all teams MUST exist in every shipped locale, but the common phrases, badge names and badge hints every team except Hamburg gets are English only (phrase translation shelved 2026-11-09, badge hints FR-014). The code follows the decision; the constitution doesn't. | Amend the constitution (minor version): a team without its own set gets the common English set, untranslated. | |
| G08 | P2 | CLAUDE.md – languages | Non-negotiable says rider-facing text is in "all ten languages", but quotes, badge names and badge hints are team content in `src/content/` in the team's language only (badge hints FR-014, seasonal monkeys). Neither CLAUDE.md nor the constitution names this exception or `src/content/`. | One sentence in CLAUDE.md (and the constitution if it covers FR-028): team content follows the team's language, lives in `src/content/`. | **Done**: CLAUDE.md names the exception. |
| G09 | P3 | Second team – Europe sandbox | T074 (Europe's sandbox) looks done (`sandbox-europe` block, Release PR box, `sandbox-pr.yml`) but is unticked. | Check the subdomain requirement (FR-042), then tick T074. | **Done**: ticked (sandbox on `sandbox-europe.trhh-rynke-coins.link`). |
| G10 | P3 | Spec status | Every spec from the second team on says **Status: Draft**, though most are shipped (only badge hints says Ready). | Set Implemented / Partly implemented / Draft per spec when touching them, or drop the field. | **Done**: Implemented / Partly implemented / Draft set from the tasks. |
| G11 | P3 | Backlog README | The order list in `specs/backlog/README.md` lists items long specified; only season data cleanup is still a prompt. | Trim to the open item(s); add new prompts there as they come up (e.g. G07). | **Done**: only the open prompt is left. |
| G12 | P3 | Old open tasks | Walk-throughs and art tasks left open in badges (T020, T072, T097, T099, T111, T118/T119, T133/T134, T137), event requests (T044), onboarding tour (T013). Per the "manual tests after deploy" rule most of these don't belong in tasks. | Tick what's done, delete walk-through tasks; keep only the owner's open art tasks. | **Done**: art tasks ticked (every badge has its picture), walk-throughs closed as dropped, the Termine tour step ticked (done with the onboarding tour). |
| G13 | P3 | Europe seasonal monkeys | Europe has `holidays: []`, so no seasonal quote monkeys. Fine while it's in placeholders, but not listed in `placeholders`, so nobody is reminded. | Decide with Team Europe (common English holidays or none) and note the decision in team data. | **Done**: `holidays` added to Europe's `placeholders`, so `team-check --deployable europe` names it; T081 mentions it. The holidays themselves are still Team Europe's call. |

## Tests

| ID | Pri | Area | Gap | Proposal | Decision |
|---|---|---|---|---|---|
| G14 | P2 | CI – e2e scope | `scripts/e2e-scope.mjs` decides which Firefox/WebKit tests run on PRs into `develop` and has no unit test. A wrong pattern silently skips cross-browser coverage until the nightly. | Extract the path classification into a pure function and test it (config change → full, e2e file → listed, src change → `@cross-browser` only, git failure → full). | **Done**: `scopeFor()` tested. It also found a gap: a changed e2e test in a subfolder was neither listed nor ran the full suite; now it is listed. |
| G15 | P3 | Dev – gateway return address | The fix keeping local sign-ins off the production gateway (`scripts/dev.mjs`, `package.json`) has no test; a later change to the scripts could send local sign-ins to production's gateway again. | A small unit test that every local/e2e start sets the return address to `""`, or a `team-check` rule. | **Done**: `test/unit/local-return-via.test.ts`. |
| G16 | P3 | Usage across teams | `src/usage/peers.ts` (hourly pull of other teams' figures) and `src/http/admin/usage-export.ts` are covered only through the admin usage integration tests (which do cover an unreachable team). | Add direct tests for a peer that returns malformed data or a wrong token, and for the export refusing a missing token. | **Done**: `test/unit/usage-peers.test.ts`. |

## How to use

Mark **Decision**, then turn the yes rows into issues or tasks in their spec; delete this
file when the ledger is empty.
