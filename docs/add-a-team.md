# Adding a team

A team gets its own site on its own domain, with its own Worker, D1 database and queue.
Adding one needs only team data, resources and a line of deployment settings, no code
that names a team (feature 026 FR-004). This page lists the steps for any team. Europe
is the example: `<id>` is `europe` and `<ID>` is `EUROPE`.

**Who does what** (FR-043): only the Strava owner sets the Strava application's
credentials on the new Worker. Any maintainer with the rights to it can do every other
step.

| Value | Example |
|---|---|
| Team ID | `<id>`: lower case letters, the same in team data, `TEAM_ID` and the gateway |
| Domain | the team's own, e.g. `rynke.example.org`; until it has one, `<id>.trhh-rynke-coins.link` (Europe for now) |
| Worker | `rynke-points-<id>` |
| D1 database | `rynke-points-<id>` |
| Queue | `rynke-points-<id>-work` |
| GitHub environment | `production-<id>` |

## 0. Before any data: the controllers' decision

Every maintainer can technically reach every team's rider data (FR-044). Before the new
team's data joins a Cloudflare account that maintainers can already reach, each affected
team's controller records the access decision, as
[feature 028](../specs/028-multiple-maintainers/spec.md) FR-017 describes. That covers
the new team's controller and the controller of every team already in the account.

## 1. What the team sends

- domain
- its Strava club, and any further clubs whose members may take part
- season start and qualification deadline
- Rynke values (rules), event kinds, and the feature switches it wants
- default language
- colours, coin, icons and its own badge pictures, if any
- own phrases and badge names, or the common ones
- the controller and the contact email for the privacy page

Until a value arrives, team data may hold the founding team's value as a placeholder
(FR-053). The team then runs locally only, and CI refuses to deploy it.

## 2. Team data (one pull request)

1. `src/teams/<id>.ts`: copy `src/teams/europe.ts` and fill it in. Register it in
   `src/teams/index.ts`. Every field still copied from another team goes into
   `placeholders`. Its `cloudflare` field names the team's Worker, database ID and,
   once known (`wrangler queues list`), its queue IDs, so each team's admin view can
   split Cloudflare's figures by team.
2. `wrangler.jsonc`: an `env.<id>` block like `env.europe`. It holds the Worker name,
   `main`, the D1 and queue bindings, the crons, **every** var of the other blocks
   (Wrangler doesn't inherit them), `TEAM_ID: "<id>"`, `secrets.required`, and
   `"routes": []` until the domain is ready. Nothing goes on the top level.
   `node scripts/team-check.mjs` names anything missing. Then run `pnpm types`.
3. Local development: `"dev:<id>": "node scripts/dev.mjs <id>"` in `package.json`, a
   `dev` target with its own ports in team data, and synthetic sample riders in
   `dev/fake-strava/samples.<id>.ts` ([contracts/dev-commands.md](../specs/026-second-team/contracts/dev-commands.md)).
4. Clubs (FR-012): add the new team's clubs to every other team's `otherClubIds`, and
   theirs to the new team's. A rider in both clubs then learns, right after connecting,
   that one team at a time works.
5. The Rynke explanation for riders: `docs/teams/<id>/rynke-punkte.md`, from the team's
   own values (FR-022).
6. `node scripts/team-check.mjs` passes. `pnpm dev:<id>` shows the team with synthetic
   riders.

## 3. Cloudflare resources

Rider data stays in the EU:

```bash
pnpm exec wrangler d1 create rynke-points-<id> --jurisdiction=eu   # ID into env.<id>
pnpm exec wrangler queues create rynke-points-<id>-work
```

For the domain, set the same DNS records as the founding team (no mail: SPF
`v=spf1 -all`, DMARC `p=reject`,
[001 quickstart](../specs/001-strava-connect-webhook/quickstart.md) step 2). Add no A or
CNAME record: the first deploy creates the custom domain. Then switch on **Always Use
HTTPS**. Bot Fight Mode once challenged Strava's webhook POSTs. Whatever rule lets them
through has to cover the new domain too (**Security → Events**).

## 4. Secrets

Every secret goes on the team's Worker with `--env <id>`, for example
`pnpm exec wrangler secret put ADMIN_TOKEN --env <id>`. Each value is new, never one
from `.dev.vars` or another team, except where a row says so.

| Secret | Who | Value |
|---|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | **Strava owner only** | the shared Strava application's |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | any maintainer | `openssl rand -hex 32`. The gateway forwards events with it |
| `TOKEN_ENCRYPTION_KEY`, `SESSION_SIGNING_KEY`, `ADMIN_TOKEN` | any maintainer | `openssl rand -base64 32`. Never change the encryption key once riders exist |
| `PUSH_VAPID_KEY` | any maintainer | the command in the README's [Deploying](../README.md#deploying) section, with `--env <id>` |
| `USAGE_EXCHANGE_TOKEN` | any maintainer | **the same value as every other team** ([usage exchange](../specs/026-second-team/contracts/usage-exchange.md)) |
| `CLOUDFLARE_ANALYTICS_TOKEN`, `CLOUDFLARE_ANALYTICS_ACCOUNT_ID` | any maintainer | optional: the read-only analytics token of the README |

## 5. The gateway

Strava sends every event to the gateway, and every sign-in comes back through it
([docs/gateway-switch.md](gateway-switch.md)).

1. Gateway secret: the new team's `STRAVA_WEBHOOK_VERIFY_TOKEN`, under the team's name:

   ```bash
   pnpm exec wrangler secret put TEAM_WEBHOOK_TOKEN_<ID> --config gateway/wrangler.jsonc
   ```

2. In a pull request:
   - add `{ "id": "<id>", "origin": "https://<domain>" }` to `TEAMS` in
     `gateway/wrangler.jsonc`
   - add `TEAM_WEBHOOK_TOKEN_<ID>` to the gateway's `secrets.required`
   - if the team's domain is on the gateway's zone (`trhh-rynke-coins.link`, its
     subdomains included), add `{ "binding": "TEAM_SERVICE_<ID>", "service": "<the
     team's Worker name>" }` to the gateway's `services`: a Worker's `fetch()` to its
     own zone never reaches another Worker there and gets a 404
   - in `env.<id>`, set `STRAVA_RETURN_VIA` to the gateway's origin and
     `STRAVA_SUBSCRIPTION_ID` to the gateway's subscription, like every other team

   Set the secret first: otherwise the gateway's forwards to the new team fail until it
   is set. The gateway keeps retrying them, so no event is lost.

## 6. Usage across teams

In the same or another pull request: list every other team in the new team's
`USAGE_PEERS`, and add the new team to every other team's. Each team's admin view then
shows every team's counts, and connected riders count against Strava's 999 together.

## 7. GitHub

1. Create the environment `production-<id>` exactly like `production`
   ([repository settings](../.github/repository-settings.md#environment-production-europe-like-production-for-team-rynkeby-europe)),
   with its own deploy credential. Create it before anything references it: a run that
   references a missing environment creates it without any rules.
2. In `.github/workflows/ci.yml`, `deploy-gate` lists the teams. Add the new team's
   entry (`team`, `environment`, `url`, `database: "DB"`, `wrangler_env: "<id>"`) behind
   its own repository variable, like Europe's behind `EUROPE_DEPLOY`. That's the line of
   deployment settings.

## 8. Sandbox

Every team gets a sandbox, its resources and one more checkbox on **Release PR**
(FR-042, [feature 027](../specs/027-sandbox-deployment/spec.md)). Until the team has its
own domain, the sandbox lives on a subdomain of the founding team's domain. The sandbox
isn't counted as a team in the shared usage figures.

## 9. Go live

1. Replace the last placeholders, empty `placeholders`, and set the domain in
   `env.<id>.routes` (`{ "pattern": "<domain>", "custom_domain": true }`).
   `node scripts/team-check.mjs --deployable <id>` passes.
2. Merge, and release to `main` as usual.
3. `gh variable set <ID>_DEPLOY --body on`, then **Actions → CI → Run workflow** on
   `main`. The team's own `deploy (<id>)` job applies its migrations, deploys it and
   creates the custom domain. The other teams' jobs are unaffected.
4. Check:
   - `https://<domain>/health` answers `ok`.
   - A real rider of the team's club connects and ends up on `/me`.
   - A rider who is also in another team's club sees the one-team-at-a-time notice.
   - After the next full hour, each team's admin view shows the other teams' counts,
     with no notice that a team didn't answer.
