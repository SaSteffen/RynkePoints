# RynkePoints

[![e2e nightly](https://github.com/SaSteffen/RynkePoints/actions/workflows/e2e-nightly.yml/badge.svg?branch=develop)](https://github.com/SaSteffen/RynkePoints/actions/workflows/e2e-nightly.yml?query=branch%3Adevelop)

RynkePoints motivates Team Rynkeby riders to train for the ride to Paris, so the team
can start, ride and arrive together. Riders connect their Strava account by choice,
and the app turns their rides and the team events they attend into gamified **Rynke
Points**, with progress charts, badges and a coin to keep training fun. It enables
organisers to support their riders on the way, while riders never see each other
ranked by name and no rider's data leaves their own team.

It is built for Team Rynkeby Hamburg. What another team needs is added so that any
team that wants to can adopt it; Team Rynkeby Europe is being set up as the first.
How it's built: [Tech stack](#tech-stack).

## What it does today

- **Connecting** ([001](specs/001-strava-connect-webhook/spec.md),
  [004](specs/004-roles-and-consent/spec.md)): members of the team's Strava club
  agree to what is read and shared, then connect their account. Connecting is
  refused, and nothing is kept, for anyone who doesn't agree or isn't a member.
  Their rides since the season start are imported, and new, changed or deleted
  activities follow through Strava's webhook.
- **Rynke** ([003](specs/003-rynke-evaluation/spec.md)): kilometres and
  elevation earn Training Rynke, team events Team Rynke and Training Rynke,
  towards what the tour needs.
- **Rider pages** ([005](specs/005-rider-view/spec.md),
  [008](specs/008-strava-ride-names/spec.md),
  [009](specs/009-rider-progress-charts/spec.md),
  [015](specs/015-rider-page-cleanup/spec.md),
  [018](specs/018-lazy-rides-list/spec.md)): riders see their Rynke, progress
  charts and rides, with links to Strava.
- **App and look** ([010](specs/010-pwa-notifications/spec.md),
  [011](specs/011-mobile-app-shell/spec.md),
  [012](specs/012-rynke-coin-fun/spec.md)): an installable app with sections,
  optional notifications for new Rynke, and the Rynke coin.
- **Badges** ([013](specs/013-badges-achievements/spec.md)): achievements for
  rides, runs and swims, and team badges.
- **Team and organisers** ([014](specs/014-organiser-admin/spec.md),
  [016](specs/016-team-leaderboard/spec.md),
  [019](specs/019-event-participation-requests/spec.md)): a team leaderboard
  without names; organisers record team events and attendance, correct Rynke
  and see riders' reports of the events they're coming to or were at.
- **Onboarding** ([020](specs/020-onboarding-tour/spec.md)): a tour that
  explains the rules.
- **Season end** ([021](specs/021-season-rollover/spec.md)): Tour de Paris
  badges and a season album PDF for every rider.
- **Look and navigation** ([022](specs/022-themes-and-controls/spec.md),
  [023](specs/023-swipe-between-sections/spec.md)): themes in the header, one set
  of controls everywhere, and swiping between sections.
- **Fair Strava budget** ([024](specs/024-fair-strava-budget/spec.md)): every
  rider gets a fair share of the requests Strava allows.
- **Figures** ([029](specs/029-organiser-progress-graphs/spec.md),
  [030](specs/030-rider-summaries/spec.md),
  [032](specs/032-ride-stats-leaderboard/spec.md)): organisers' progress graphs,
  and sessions, kilometres and elevation per season, month and week, ranked
  without names, with each rider's typical ride.
- **Badge extras** ([033](specs/033-badge-sharing/spec.md),
  [034](specs/034-badge-hints/spec.md),
  [035](specs/035-seasonal-monkeys/spec.md),
  [037](specs/037-seasonal-monkeys-next/spec.md),
  [038](specs/038-december-monkeys/spec.md)): sharing a badge, hints from the
  monkey, and seasonal quote monkeys.
- **Edited rides** ([036](specs/036-ride-edit-recheck/spec.md)): a ride changed
  on Strava is checked again.
- **Team rules and seasons** ([039](specs/039-europe-rules/spec.md),
  [040](specs/040-season-window-split/spec.md)): each team's own rules, and a
  qualification window inside the season.
- **One team at a time** ([044](specs/044-one-team-at-a-time/spec.md)): a rider
  rides for one team; switching deletes everything at the team they leave.
- **Admin view** ([025](specs/025-admin-usage-view/spec.md),
  [041](specs/041-admin-every-team/spec.md),
  [043](specs/043-admin-grants-roles/spec.md),
  [045](specs/045-riders-and-roles/spec.md),
  [047](specs/047-strava-call-counts/spec.md)): on every team's site,
  administrators see how much of the Strava and Cloudflare allowances is used,
  with a daily history and alerts near a limit; they see who is connected, give and take the
  organiser and administrator roles, and can remove and block a rider.
- **Privacy page** ([017](specs/017-privacy-page/spec.md)): see
  [Privacy](#privacy).

## Privacy

The privacy notice riders see is at `/privacy`, linked from every page's footer
([feature 017](specs/017-privacy-page/spec.md)). It names the controller and a
contact address, set as `PRIVACY_CONTROLLER` and `CONTACT_EMAIL` in
`wrangler.jsonc`. This section is the same in short.

- **Scopes**: `read` and `activity:read` are required. `activity:read_all` is
  optional: only if the rider grants it are their private ("Only You")
  activities included. `activity:write` is not requested: nothing writes to
  Strava.
- **From Strava, per rider**: the athlete ID, first name (for the greeting and
  the organisers), the granted scopes, and the Strava tokens, encrypted
  (AES-256-GCM).
- **Per ride**: its name (shown only to that rider), sport type, start time,
  time zone, distance, moving and elapsed time, elevation gain, the manual,
  trainer and private flags, and whether Strava has flagged it. **Per run and
  per swim**, for the badges: only the start time, distance and private flag.
  Only activities from the season start on are stored; older ones are skipped
  and removed daily. No GPS tracks, maps, descriptions, photos, heart rate,
  power or other health data, and no other kinds of activity.
- **Entered by the team**: which team events a rider attended (kind, date and
  an optional event name) and organisers' Rynke corrections, with who changed
  them and when; riders' own reports of events they're coming to or were at.
  **Worked out**: Rynke, badges and why each ride counts; sessions, kilometres
  and elevation per season, month and week, and a rider's typical ride; after
  the qualification deadline, whether each rider had reached the training goal,
  kept for the organisers until the next season starts.
- **Consent**: the version and time of the text the rider agreed to. A new
  version asks every rider again before showing anything.
- **Block list and usage records**: when an administrator removes a rider, only
  their Strava athlete ID stays on the team's block list, with no name, date or
  reason, and a record says when and by which administrator, not whom. Daily usage
  records hold no rider data.
- **Who sees what**: riders see their own rides and Rynke; the team sees
  everyone's Rynke without names, and team sums and team badges that count
  everyone's kilometres, elevation and riding times; organisers see first names,
  Rynke and their breakdown, team events, reports and corrections, sessions and
  kilometres and elevation as totals per day, and typical rides, but no single
  rides; administrators are always organisers too, and also see connection state
  and dates and whether an import is running.
- **One team at a time**: when someone connects, the team asks the other teams
  whether they already ride for one. It learns only yes or no, never which team,
  and stores no answer.
- **Strava gateway**: keeps each rider's Strava athlete ID with the teams that
  hold them, and nothing else, in the EU, to steer Strava's events; only the
  maintainers can see it, and it is deleted when the rider leaves.
- **Notifications**: for each device a rider turns them on for, only the
  address its push service gives it. Notifications are sent empty; the device
  fetches the text. The address is deleted when they turn notifications off,
  sign out on that device or leave.
- **Deletion**: everything about a rider is deleted at once, and their Strava
  access revoked where it still works, when they disconnect on their page or
  remove the app in their Strava settings, within 24 hours after they leave the
  club, and 7 days after their connection broke if they don't reconnect.
  Deleted data stays in Cloudflare's D1 backups for up to 7 days, then
  disappears.
- **Logs**: the app's log lines carry identifiers only, never tokens
  (`test/unit/no-secret-logging.test.ts`). Cloudflare's invocation logs are
  off, because they record request URLs and the webhook's URL holds its secret.
- **Cookies**: only necessary ones. `rp_session` keeps a rider signed in
  (180 days after their last visit), `rp_oauth_state` protects the 10-minute
  Strava sign-in, and `rp_lang` remembers a picked language for a year. The
  language is never stored in the database.
- **Processing**: Cloudflare Workers, Queues and D1. No other service receives
  Strava data, and none of it is used for AI or analytics. The season albums
  are made on the maintainer's computer (`pnpm season:album`), handed to each
  rider and then deleted.

## Teams

Each team has its own site on its own domain, with its own Worker, D1 database and
queue, so no rider's data is readable from another team
([026](specs/026-second-team/spec.md)). The same code serves every team:

- **Team data**: everything that differs between teams is data, in
  `teams/<id>/team.ts` (rules, colours, art, phrases, badge names, languages) and in
  the team's block of `wrangler.jsonc` (club, dates, switches, contact). The rest of
  what a team owns sits beside it in `teams/<id>/`: own phrases and badge names,
  synthetic sample riders, coin and badge originals, and the rules handout's source.
  `node scripts/team-check.mjs` checks both halves. A team still holding another
  team's values is never deployed (`--deployable <id>`).
- **Strava gateway** (`gateway/`): Strava allows one webhook subscription and one
  sign-in return domain per application. The gateway keeps a copy of which teams
  hold which athletes, to send each event only to them
  ([046](specs/046-gateway-routing/spec.md)); for now, as a trial, it still sends
  every event to every team. It sends a rider coming back from Strava on to their own team. Moving
  Hamburg behind it is a manual step: [docs/gateway-switch.md](docs/gateway-switch.md).
- **Shared allowances**: Strava's request limits and its 999 connected athletes
  count for all teams together. Each team's admin view shows every team's share
  ([contracts/usage-exchange.md](specs/026-second-team/contracts/usage-exchange.md)),
  and calls the other teams "Other team": no page names another team.

Adding a team takes team data, resources and one line of deployment settings, no
code: [docs/add-a-team.md](docs/add-a-team.md).

## Tech stack

RynkePoints is one TypeScript codebase that runs serverless on Cloudflare's free plan,
with almost no runtime dependencies:

- **Each team** is its own Cloudflare Worker, with its own D1 database (in the EU),
  queue and two cron jobs. Pages are rendered in the Worker, with no front-end
  framework, and the app installs as a PWA with notifications.
- **Strava** is read only, through one Strava application that all teams share. A
  small gateway Worker receives its webhook and sign-ins and passes them on.
- **Background work** (imports, new rides, membership checks, Rynke) runs on the
  queue, within Strava's and Cloudflare's daily limits.
- **Development** needs neither a Strava nor a Cloudflare account: `pnpm dev` runs
  every team against a fake Strava with synthetic riders.

The details, with diagrams, are in [How RynkePoints runs](docs/how-it-runs.md): the
parts and why each was chosen, Strava, Cloudflare, which jobs run when, the usage
limits, and deploying.

## Languages

Every team's site offers ten languages: Dansk, Deutsch, English, Français,
Íslenska, Lietuvių, Nederlands, Norsk bokmål, Suomi and Svenska. The browser's
preferred language decides, and a switcher on every page overrides it. With no
preference stated, a team's own default applies: German for Hamburg, English for
Europe ([contracts/locales.md](specs/026-second-team/contracts/locales.md)). The
English text is the reference where translations differ.

All rider-facing text lives in `src/i18n/messages/<locale>.ts`, never inline in
pages or logic. German is the key source: every catalog has exactly its keys,
placeholders and plural forms, which a unit test checks. Message IDs are listed in
[contracts/messages.md](specs/001-strava-connect-webhook/contracts/messages.md).
To add a language, add its catalog file and its common phrases
(`src/content/phrases/common.<code>.ts`) and register it in
`src/i18n/catalogs.ts`; no other code changes.

## Getting started

### 1. A shell

Everything here runs in a Unix shell (bash or zsh), and needs git:

- **Linux**: any terminal. Install git with your package manager if `git --version`
  doesn't find it.
- **macOS**: the Terminal app. `xcode-select --install` adds git.
- **Windows**: WSL 2 with Ubuntu. Run `wsl --install` in an administrator
  PowerShell, restart, and open *Ubuntu* from the Start menu
  ([Microsoft's guide](https://learn.microsoft.com/windows/wsl/install)). Work in
  that terminal from now on, and clone into your Linux home folder (`~`), not under
  `/mnt/c`, where everything is much slower.

### 2. Node and pnpm

- **Node 24**, the version in `.nvmrc`. The simplest way to get it is
  [nvm](https://github.com/nvm-sh/nvm#installing-and-updating): install it, open a
  new terminal, then run `nvm install` in the repository. It reads `.nvmrc`.
- **pnpm** comes with Node through Corepack. Run `corepack enable` once, and pnpm
  then uses the version that `package.json` names.

```bash
node --version      # v24.…
pnpm --version      # 10.…
```

That is everything building, testing and running the app needs. **Python is not
among it**: only Spec Kit uses it (see step 4).

### 3. Run it

```bash
git clone https://github.com/SaSteffen/RynkePoints.git
cd RynkePoints
nvm install && corepack enable
pnpm install                # dependencies and git hooks
pnpm test
pnpm dev                    # every team with a fake Strava, behind a local gateway
pnpm dev:hamburg            # one team, without the gateway (also dev:europe)
```

`pnpm dev` needs no Strava account: a fake Strava with synthetic sample riders
answers instead, and each team's `/_dev/` signs you in as any of them
([feature 006 quickstart](specs/006-local-frontend-dev/quickstart.md)). Hamburg
runs on `http://localhost:8789`, Europe on `http://europe.localhost:8790`, and the
Strava gateway on `http://localhost:8791`: sign-ins come back and simulated events
arrive through it, as in production
([feature 026 contracts](specs/026-second-team/contracts/dev-commands.md)).

### 4. Developing with Claude Code

RynkePoints is built with [Claude Code](https://claude.com/claude-code), Anthropic's
coding agent for the terminal, and is best developed with it. Install it as its page
describes (on Linux, macOS and WSL:
`curl -fsSL https://claude.ai/install.sh | bash`). It needs a Claude plan or an
Anthropic API key. Then start it in the repository with `claude`.

The repository carries the harness Claude Code works within:

- **`CLAUDE.md`**: the commands, branch rules and non-negotiables. Claude Code reads
  it at the start of every session.
- **The [constitution](.specify/memory/constitution.md)**: the project's principles
  (consent and privacy, good Strava citizenship, test-first). `CLAUDE.md` defers to
  it, and every spec and plan is checked against it.
- **[Spec Kit](https://github.com/github/spec-kit)** ([docs](https://github.github.io/spec-kit/)):
  GitHub's toolkit for spec-driven development. Its steps are slash commands in
  `.claude/skills/speckit-*`, with their scripts and templates in `.specify/`.
- **Git hooks**: lefthook runs Biome, `tsc` and commitlint before each commit, so
  agent and human commits get the same checks.

A feature goes through Spec Kit's steps. Each one writes into
`specs/<number>-<name>/`:

| Step | Command | Writes |
|---|---|---|
| Specify | `/speckit-specify <what and why>` | `spec.md`, on a new branch |
| Clarify | `/speckit-clarify` | answers to open questions, into `spec.md` |
| Plan | `/speckit-plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| Tasks | `/speckit-tasks` | `tasks.md` |
| Analyze | `/speckit-analyze` | a consistency check across the three, no files |
| Implement | `/speckit-implement` | tests first, then code, task by task |
| Converge | `/speckit-converge` | work still unbuilt, as new tasks in `tasks.md` |

#### Spec Kit needs Python

The skills, scripts and templates are committed, so the slash commands work in
Claude Code without installing Spec Kit itself. But their scripts
(`.specify/scripts/python/`) are Python, so Spec Kit is the one place Python is
needed: **Python 3.11 or newer** (`python3 --version`). Current Linux releases
(Ubuntu 24.04 on WSL, for one) and macOS with the Xcode tools usually have it; if
yours is older, install a newer one with your package manager.

Spec Kit's `specify` command line tool is optional. Install it only to upgrade the
committed files. It is installed with [uv](https://docs.astral.sh/uv/getting-started/installation/),
a Python package manager:

```bash
uv tool install specify-cli          # once
specify version                      # check that it runs
specify integration upgrade claude   # refresh .specify/ and the skills; review the diff
```

More in Spec Kit's [documentation](https://github.github.io/spec-kit/): the
[SDD walkthrough](https://github.github.io/spec-kit/quickstart.html) of the steps
above, [installation](https://github.github.io/spec-kit/installation.html) and
[upgrading](https://github.github.io/spec-kit/upgrade.html). The project's own
rules for it are in the [constitution](.specify/memory/constitution.md) and
`CLAUDE.md`.

### Browser tests

The browser smoke tests run the same fake mode, on port 8797 with its own state,
in Chromium, Firefox and WebKit:

```bash
pnpm exec playwright install chromium firefox webkit   # once
pnpm test:e2e
pnpm test:e2e --project=firefox                         # one browser
```

Where WebKit doesn't run natively (Arch, for one), serve it from Playwright's
Docker image and point the tests at it:

```bash
pnpm test:e2e:webkit                                     # keeps running
E2E_WEBKIT_SERVER=ws://127.0.0.1:3797/ pnpm test:e2e
```

Docker is only needed for that. Rendering the rules handouts (`pnpm docs:pdf`) also
needs pandoc and Chrome or Chromium.

### Against the real Strava

For this you need your own
[Strava API application](https://www.strava.com/settings/api):

```bash
cp .dev.vars.example .dev.vars   # fill in your Strava API app credentials
pnpm wrangler d1 migrations apply DB --local --env hamburg   # local database
pnpm dev:strava             # local Worker on http://localhost:8789, real Strava
```

Neither this nor `pnpm dev` needs a Cloudflare account: production is deployed by CI (see
[Deploying](#deploying)). More on running against the real Strava locally is in the
[feature quickstart](specs/001-strava-connect-webhook/quickstart.md#2-local-manual-run-against-the-real-strava-maintainer-only).

### Maintainer tasks

Occasional tasks, each described at the top of its script:

| Command | Does |
|---|---|
| `pnpm daily:run` | starts the daily job now ([007](specs/007-manual-daily-run/spec.md)) |
| `pnpm catch-up <since>` | re-reads every rider's rides since a moment, e.g. after moving the webhook ([gateway switch](docs/gateway-switch.md)) |
| `pnpm season:album` | season album PDFs into `season-albums/` (`--local`: from `pnpm dev`'s sample season) |
| `pnpm strava:review` | material for Strava's Developer Program form |
| `pnpm docs:pdf` | renders each team's rules handout (`teams/<id>/rynke-p*.md`) to PDF |

## Contributing

### Branch model

- `main` is the last released state.
- `develop` is the integration branch and the default branch.

### Proposing a change

Cut a branch from `develop` and open a pull request into `develop`. Every pull
request is merged with a merge commit, never squashed, so the branch's commits stay
in the history. Each of them, and the PR title, must be a
[Conventional Commit](https://www.conventionalcommits.org/) (`feat: …`,
`fix: …`, `docs: …`) within 100 characters. The title is what the release pull
request lists for the change.

Opening a pull request doesn't merge it. It merges when someone merges it, or clicks
**Enable auto-merge** on it.

### What has to pass

Every pull request into `main` or `develop` runs seven checks. Each mirrors a
command you can run locally:

| Check | Local command |
|---|---|
| `lint` | `pnpm lint` |
| `typecheck` | `pnpm typecheck` |
| `test` | `pnpm test` |
| `e2e` | `pnpm test:e2e` (Chromium, Firefox, WebKit; see below) |
| `commit-messages` | `pnpm commitlint --from origin/develop --to HEAD` |
| `pr-title` | `printf '%s (#%s)\n' "<title>" <number> \| pnpm commitlint` |
| `pr-source` | PRs into `main` must come from `develop` or `hotfix/*` |

`ci.yml` also has the jobs `already-checked`, `deploy-gate` and `deploy`. They
run only on `main`, show as skipped on pull requests and are not required checks.
After a merge into `main`, `already-checked` skips `lint`, `typecheck`, `test`
and `e2e` when the merged commit has the same content as the pull request they
passed on.
Merges into `develop` don't re-run them at all.

On any pull request, the job `scope` skips `test` and `e2e` when every changed
path is one no test reads: `docs/`, `specs/`, `.specify/`, `.claude/`, `content/`,
Markdown files at the top level but `CHANGELOG.md`, `LICENSE`, and `.github/` except `ci.yml` and the
setup action (`scripts/test-scope.mjs`). A skipped job passes its required check.
`scope` isn't a required check either.
A version pull request, which changes only the version in `package.json` and
`CHANGELOG.md`, runs just the changelog's and Settings' tests and no `e2e`.

On a pull request into `develop`, `e2e` runs Chromium and Europe in full, but
Firefox and WebKit only for the tests tagged `@cross-browser` and the e2e files the
pull request adds or changes (`scripts/e2e-scope.mjs`). A change to
`playwright.config.ts`, a shared e2e helper or Playwright itself runs everything.
Pull requests into `main` always run everything, and `e2e-nightly.yml` runs the
full suite on `develop` each night, one job per browser, when `develop` moved.
Tag a test with `{ tag: "@cross-browser" }` when it guards something browsers
differ on (cookies, layout, canvas, sharing). To run the pull request's set
locally:

```bash
E2E_SCOPE=pr E2E_CHANGED=smoke.e2e.ts pnpm test:e2e
```

The lefthook git hooks run the same Biome, `tsc` and commitlint before each
commit, so a branch that commits cleanly usually passes. A check that failed for
a flaky or infrastructure reason can be re-run from the PR's **Checks** tab
without a new commit.

Pull requests from forks get the same checks, without secrets. A first-time
contributor's checks start once the maintainer approves the run.

### Protected branches

Nobody can push to, force-push or delete `main` or `develop`, the owner
included, and there is no bypass. The only way in is a pull request whose
required checks passed. A pull request into `develop` must also be up to date
with `develop`; use **Update branch** if it isn't. The protection lives in
[.github/rulesets/](.github/rulesets/README.md) and
[.github/repository-settings.md](.github/repository-settings.md), which are the
source of truth.

### Releasing

Every release has a new [semver](https://semver.org/) version. Settings shows it
and links to the changelog at `/changelog`. Before a release, open a pull request
into `develop` that raises `version` in `package.json` and adds the release at
the top of [CHANGELOG.md](CHANGELOG.md), in English, without naming a team. The Conventional
Commits since the last release say how far to go: a breaking change (`feat!: …`)
raises the major number, a `feat` the minor number, anything else the patch number.
A hotfix raises the patch number on its own branch. **Release PR** stops when
`develop` still has `main`'s version, warns when the bump is smaller than the
pull requests call for, and puts both versions in the description. In Claude
Code, the `release` skill does both steps: it opens the version pull request, and
once that is merged, it starts **Release PR**.

```bash
gh pr create --base main --head develop --title "chore: release"
```

The same seven checks run, and `pr-source` only allows `develop` and `hotfix/*`
as sources for `main`. Merge with **Create a merge commit**, the only method
`main` allows. The release PR doesn't need to be up to date with `main`, because
the checks already run on the result of merging it. Afterwards, `main` has
nothing that `develop` lacks.

Merging the release PR deploys it (see [Deploying](#deploying)). Before you
merge, check that:

- every new file in `migrations/` keeps the currently deployed version working;
- changes to storage or to anything other riders see were self-reviewed against
  Principle I of the [constitution](.specify/memory/constitution.md).

### Sandboxes

Hamburg and Europe each have a sandbox: the team's app in fake mode on the internet, with the
sample riders and the fake Strava, open to the maintainers only (Cloudflare Access). To try a
pull request into `develop` there, tick *Deploy to Hamburg's sandbox* or *Deploy to Europe's
sandbox* in its description; for a release, tick them on **Actions → Release PR**. The box
unticks itself, the commit deploys once `lint`, `typecheck` and `test` passed, and a message on
the pull request has the link. Deployments keep the sandbox's data; **Actions → Sandbox reseed**
rebuilds it from fresh sample riders. Skip it for docs, specs, tests, CI or tooling only; deploy for migrations, anything
riders see, or when unsure. Details, the daily budget and the setup:
[docs/sandboxes.md](docs/sandboxes.md).

### Hotfixes

1. Cut `hotfix/<short-name>` from `origin/main`, commit conventionally, and open
   a pull request into `main`. Merge it with a merge commit once it's green.
   Merging it into `main` deploys the hotfix.
2. Carry the fix back to `develop`:

   ```bash
   git fetch origin
   git switch -c sync/<short-name> origin/main
   git merge origin/develop   # keep the default message; commitlint ignores it
   git push -u origin sync/<short-name>
   gh pr create --base develop --title "chore: merge main back into develop"
   ```

   Merge it with **Create a merge commit**.

There is no direct `main` → `develop` pull request, because **Update branch** on
it would be a forbidden push to `main`. If a release PR is open, the back-merge
re-runs its checks. No hotfix is possible before the first release has brought
the workflows onto `main`.

### Working branches

| Kind | Name | Cut from | PR into | Merge method |
|---|---|---|---|---|
| feature / fix | any, e.g. `003-points-rules`, `fix/…` | `develop` | `develop` | merge commit |
| hotfix | `hotfix/<short-name>` | `main` | `main` | merge commit |
| back-merge | `sync/<short-name>` | `main`, with `origin/develop` merged in | `develop` | merge commit |
| release | `develop` itself | — | `main` | merge commit |

## Deploying

Merging into `main` deploys. Once the checks pass on the merged commit, CI deploys
each team on its own: it applies the team's pending D1 migrations, then publishes
its Worker. Merges into `develop` deploy nothing, and nobody deploys production by
hand. Migrations only go forward, so a migration must keep the previously deployed
version working: add first, and remove or rename only in a later release.

Which commit runs, failed deploys, re-deploying, rollback, the secrets and the
one-time setup are in [How RynkePoints runs](docs/how-it-runs.md#deploying).

## Project principles

See [.specify/memory/constitution.md](.specify/memory/constitution.md). In short:
riders' consent and privacy first, good Strava API citizenship (webhooks, rate
limits), never writing to Strava, serverless with minimal dependencies,
and test-first development.

## License

[Unlicense](LICENSE) — public domain.
