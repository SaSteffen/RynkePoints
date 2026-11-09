# RynkePoints

Strava integration for Team Rynkeby teams: Team Rynkeby Hamburg, the founding
team, and Team Rynkeby Europe, which is being set up. Riders connect their Strava account
(opt-in), the app collects key data from their activities (distance, date, elevation
gain, …), counts the team events they attended, and awards gamified **Rynke Points**.
Writing their points into the Strava activity description, with the rider's
permission, is planned for a later feature.

Runs serverless on Cloudflare Workers, with D1 for storage and Queues for
processing Strava webhook events.

Features are specified and built with
[Spec Kit](https://github.com/github/spec-kit); each has its own folder under
`specs/`.

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
- **Admin view** ([025](specs/025-admin-usage-view/spec.md)): administrators see
  how much of the Strava and Cloudflare allowances is used, with a daily history
  and alerts near a limit, see who is connected, and can remove and block a rider.
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
  Strava. A later feature that adds a Rynke section to ride descriptions will
  ask for it, with its own consent.
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
  **Worked out**: Rynke, badges and why each ride counts.
- **Consent**: the version and time of the text the rider agreed to. A new
  version asks every rider again before showing anything.
- **Block list and usage records**: when an administrator removes a rider, only
  their Strava athlete ID stays on the team's block list, with no name, date or
  reason, and a record says when and by which administrator, not whom. Daily usage
  records hold no rider data.
- **Who sees what**: riders see their own rides and Rynke; the team sees
  everyone's Rynke without names, and team sums and team badges that count
  everyone's kilometres, elevation and riding times; organisers see first names,
  Rynke and their breakdown, team events, reports and corrections, but no single
  rides; administrators see first names, connection state and dates, and whether
  an import is running, and no rides or Rynke.
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
  `src/teams/<id>.ts` (rules, colours, art, phrases, badge names, languages) and in
  the team's block of `wrangler.jsonc` (club, dates, switches, contact).
  `node scripts/team-check.mjs` checks both halves. A team still holding another
  team's values is never deployed (`--deployable <id>`).
- **Strava gateway** (`gateway/`): Strava allows one webhook subscription and one
  sign-in return domain per application. The gateway forwards every event to every
  team and sends a rider coming back from Strava on to their own team. Moving
  Hamburg behind it is a manual step: [docs/gateway-switch.md](docs/gateway-switch.md).
- **Shared allowances**: Strava's request limits and its 999 connected athletes
  count for all teams together. Each team's admin view shows every team's share
  ([contracts/usage-exchange.md](specs/026-second-team/contracts/usage-exchange.md)),
  and calls the other teams "Other team": no page names another team.

Adding a team takes team data, resources and one line of deployment settings, no
code: [docs/add-a-team.md](docs/add-a-team.md).

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

Requirements: Node 24 (see `.nvmrc`) and pnpm (`corepack enable`).

```bash
pnpm install                # deps + git hooks
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

Against the real Strava you need your own
[Strava API application](https://www.strava.com/settings/api):

```bash
cp .dev.vars.example .dev.vars   # fill in your Strava API app credentials
pnpm wrangler d1 migrations apply DB --local --env hamburg   # local database
pnpm dev:strava             # local Worker on http://localhost:8789, real Strava
```

You don't need a Cloudflare account for either: production is deployed by CI (see
[Deploying](#deploying)).

Running against the real Strava locally, and the manual one-time production
steps (Cloudflare resources, secrets, the webhook subscription and Strava's
brand assets, which are English only and used for every language), are in the
[feature quickstart](specs/001-strava-connect-webhook/quickstart.md). The D1
database must be created with `--jurisdiction=eu` before the first deploy, so
rider data stays in the EU.

Occasional maintainer tasks, each described at the top of its script:

| Command | Does |
|---|---|
| `pnpm daily:run` | starts the daily job now ([007](specs/007-manual-daily-run/spec.md)) |
| `pnpm catch-up <since>` | re-reads every rider's rides since a moment, e.g. after moving the webhook ([gateway switch](docs/gateway-switch.md)) |
| `pnpm season:album` | season album PDFs into `season-albums/` (`--local`: from `pnpm dev`'s sample season) |
| `pnpm strava:review` | material for Strava's Developer Program form |
| `pnpm docs:pdf` | renders the rules handout `docs/rynke-punkte.md` to PDF |

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
| `e2e` | `pnpm test:e2e` (Chromium, Firefox, WebKit) |
| `commit-messages` | `pnpm commitlint --from origin/develop --to HEAD` |
| `pr-title` | `printf '%s (#%s)\n' "<title>" <number> \| pnpm commitlint` |
| `pr-source` | PRs into `main` must come from `develop` or `hotfix/*` |

`ci.yml` also has the jobs `already-checked`, `deploy-gate` and `deploy`. They
run only on `main`, show as skipped on pull requests and are not required checks.
After a merge into `main`, `already-checked` skips `lint`, `typecheck`, `test`
and `e2e` when the merged commit has the same content as the pull request they
passed on.
Merges into `develop` don't re-run them at all.

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

Merging into `main` deploys. Once `lint`, `typecheck`, `test` and `e2e` pass on the
merged commit, CI deploys each team from its own GitHub environment (`production`
for Hamburg, `production-europe` for Europe): it applies the team's pending D1
migrations, then publishes its Worker. One team's failure never stops another's.
Europe is only deployed while the repository variable `EUROPE_DEPLOY` is `on`, and
the gateway only while `GATEWAY_DEPLOY` is `on`
([repository settings](.github/repository-settings.md)). Nothing else deploys;
merges into `develop` don't.

- **Migrations** run first. They're forward-only and never rolled back, so a
  migration must keep the previously deployed version working: add tables and
  columns, don't rename or drop them in the same release. Remove old parts in a
  later release.
- **Which commit runs**: **Deployments → production** (Hamburg) or
  **production-europe** on GitHub. The Cloudflare version message carries the
  commit SHA too.
- **When a deploy fails**, the run on the `main` commit is red, the deployment
  shows *failure*, the maintainer gets an e-mail, and the previous version keeps
  serving.
- **Re-deploy**: `gh workflow run ci.yml --ref main` (or **Actions → CI → Run
  workflow → `main`**). It re-runs the checks and deploys the tip of `main` only.
- **Rollback**: preferably revert the change through a [hotfix](#hotfixes). As a
  break-glass, `pnpm wrangler rollback <version-id> --message "rollback: <reason>"`
  restores an earlier version at once, with limits: migrations stay applied,
  only the last 100 versions are available, GitHub doesn't see it, and the next
  merge or dispatch deploys `main` again.
- **A local `pnpm run deploy <team>`** (e.g. `hamburg`) is break-glass only. Every
  Wrangler command below names its team with `--env <team>`; without it, it fails.
- **Push key**: the deploy fails without the secret `PUSH_VAPID_KEY`, an EC
  P-256 key that signs notifications. Set it once:

  ```bash
  node -e 'crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign"]).then(k=>crypto.subtle.exportKey("jwk",k.privateKey)).then(({kty,crv,x,y,d})=>console.log(JSON.stringify({kty,crv,x,y,d})))' \
    | pnpm wrangler secret put PUSH_VAPID_KEY --env hamburg
  ```

  Keep it: a new key ends the notifications of every rider's devices until
  they turn them on again.

- **Admin view** ([025](specs/025-admin-usage-view/spec.md)): Cloudflare's figures
  need a token that has only *Account Analytics Read*, and the account ID. Without
  them the view says they're unavailable, and everything else works. These are set
  by hand, as are the flag and lifting a block.

  To get the token, go to *My Profile → API Tokens → Create Token → Create Custom
  Token* in the Cloudflare dashboard. Give it the permission *Account → Account
  Analytics → Read* and include only this account. The account ID is in the output
  of `pnpm wrangler whoami`. Each `secret put` asks for the value. To see the figures
  at once, use *Update now* on `/admin`; otherwise they come with the next hourly run.
  If the view still says they're unavailable, `pnpm wrangler tail --env hamburg` during an update
  shows the reason.

  ```bash
  pnpm wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN --env hamburg
  pnpm wrangler secret put CLOUDFLARE_ANALYTICS_ACCOUNT_ID --env hamburg
  # Mark an administrator; `= 0` clears it, from the next request on.
  pnpm wrangler d1 execute DB --remote --env hamburg \
    --command "UPDATE riders SET administrator = 1 WHERE athlete_id = <id>"
  # Lift a block. The list holds no names, so this needs the rider's Strava ID.
  pnpm wrangler d1 execute DB --remote --env hamburg \
    --command "DELETE FROM blocked_athletes WHERE athlete_id = <id>"
  ```

The one-time setup, the validation scenarios and rotating the deploy credential
are in the [CI and branch protection quickstart](specs/002-ci-branch-protection/quickstart.md),
§7–§11.

## Project principles

See [.specify/memory/constitution.md](.specify/memory/constitution.md). In short:
riders' consent and privacy first, good Strava API citizenship (webhooks, rate
limits), never overwrite what riders wrote, serverless with minimal dependencies,
and test-first development.

## License

[Unlicense](LICENSE) — public domain.
