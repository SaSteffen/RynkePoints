# Switching to the Strava gateway

Strava allows one webhook subscription and one sign-in return domain per application. With
more than one team, both go through the gateway (`gateway/`, feature 026 release 3,
[contracts/gateway.md](../specs/026-second-team/contracts/gateway.md)): it forwards every
event to every team, and sends a rider who comes back from Strava on to their own team.

This page lists the manual steps that put Hamburg behind it. Each step works on its own, and
every state in between works ([compatibility table](../specs/026-second-team/contracts/gateway.md#compatibility-fr-037)).
The Strava owner does the steps that need the Strava client secret, and nobody else.

| Value | Here |
|---|---|
| Gateway | `https://gateway.trhh-rynke-coins.link` |
| Hamburg | `https://trhh-rynke-coins.link` |
| Gateway token | a new random value, not Hamburg's (`openssl rand -hex 32`) |

## 1. Deploy the gateway

1. GitHub: create the environment `production-gateway` like `production`
   ([repository settings](../.github/repository-settings.md#environment-production-main-only-no-admin-bypass)):
   `main` only, no bypass, with its own `CLOUDFLARE_API_TOKEN` secret and
   `CLOUDFLARE_ACCOUNT_ID` variable.
2. Cloudflare: create the queue and the gateway's secrets.

   ```bash
   pnpm exec wrangler queues create rynke-points-gateway-forward
   pnpm exec wrangler secret put STRAVA_WEBHOOK_VERIFY_TOKEN --config gateway/wrangler.jsonc   # the gateway token
   pnpm exec wrangler secret put TEAM_WEBHOOK_TOKEN_HAMBURG --config gateway/wrangler.jsonc    # Hamburg's STRAVA_WEBHOOK_VERIFY_TOKEN
   ```

3. GitHub: set the repository variable `GATEWAY_DEPLOY` to `on`
   (`gh variable set GATEWAY_DEPLOY --body on`). Then run the CI workflow on `main`
   (**Actions → CI → Run workflow**). The `deploy-gateway` job deploys it and creates the
   custom domain. Later merges deploy it again only when `gateway/` changed.
4. Check: `curl https://gateway.trhh-rynke-coins.link/health` answers `ok`.
5. Cloudflare **Security → Events**: Bot Fight Mode challenged Strava's webhook POSTs on the
   team domain once. Whatever rule lets them through there has to cover the gateway's host
   too.

Nothing has changed for riders yet.

## 2. Send sign-ins through the gateway

1. In `wrangler.jsonc`, set Hamburg's `STRAVA_RETURN_VIA` to
   `https://gateway.trhh-rynke-coins.link`, and merge that through a pull request. The deploy
   on `main` takes it live.
2. Check a real sign-in: on the live site, connect again (or use a test account). Strava's
   page has to accept the return address: the gateway is a subdomain of the application's
   callback domain. You end up on `/me`.
3. If Strava refuses it: set `STRAVA_RETURN_VIA` back to `""` and deploy. Everything is as
   before.

## 3. Move the subscription (Strava owner)

Strava can't change where a subscription sends its events: it is deleted and created again,
with a new ID. While no subscription exists, Strava sends nothing, and a team that doesn't
know the new ID yet drops its events. Hamburg reads the new ID from the secret
`STRAVA_SUBSCRIPTION_ID_OVERRIDE`, which takes effect within seconds and needs no deploy,
so the gap lasts about a minute. Do it in the evening, when few rides come in, and run the
catch-up at the end for that minute.

```bash
export CLIENT_ID=… CLIENT_SECRET=…        # the Strava application's, from its settings page
T0=$(date +%s); echo "$T0"                 # note it

# The current subscription and its ID.
curl -sG https://www.strava.com/api/v3/push_subscriptions \
  -d client_id="$CLIENT_ID" -d client_secret="$CLIENT_SECRET"

# Delete it, then create the gateway's. Strava checks the callback at once; the
# gateway answers its challenge with the gateway token.
curl -s -X DELETE "https://www.strava.com/api/v3/push_subscriptions/<old id>?client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET"
curl -s -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id="$CLIENT_ID" -F client_secret="$CLIENT_SECRET" \
  -F callback_url="https://gateway.trhh-rynke-coins.link/strava/webhook/<gateway token>" \
  -F verify_token="<gateway token>"

# At once: Hamburg accepts the new ID (prompts for it).
pnpm exec wrangler secret put STRAVA_SUBSCRIPTION_ID_OVERRIDE
```

Then:

1. Re-read the gap:

   ```bash
   ADMIN_TOKEN=… pnpm catch-up "$T0"
   ```

   This queues a re-read of every connected rider's rides since `T0`. It stores new and
   changed rides with their Rynke. A ride *deleted* in the gap stays until its rider
   changes or deletes it again. A rider who revoked access in the gap is found by the
   daily run, whose Strava calls then fail.
2. Put the new ID in `STRAVA_SUBSCRIPTION_ID` for every team in `wrangler.jsonc`, and merge
   that through a pull request; there's no hurry. Once it is live, remove the secret:
   `pnpm exec wrangler secret delete STRAVA_SUBSCRIPTION_ID_OVERRIDE`. Both hold the same
   ID meanwhile, so nothing is dropped.

## 4. Watch

For a day, check the following:

- The gateway's logs in Cloudflare show `forward team=hamburg status=200 attempt=1` lines.
  A growing `attempt` means Hamburg answers with errors, and the gateway keeps retrying
  with longer and longer delays.
- New rides show up on the site, and the admin view shows no failed work.

## Switching back

Do the same steps in reverse:

1. Create the subscription on Hamburg's own URL again
   (`https://trhh-rynke-coins.link/strava/webhook/<Hamburg's token>`, with Hamburg's token
   as `verify_token`), and put its ID in `STRAVA_SUBSCRIPTION_ID_OVERRIDE` at once.
2. Run `pnpm catch-up` since the moment you started.
3. Set the new ID and `STRAVA_RETURN_VIA: ""` in `wrangler.jsonc`, deploy, and remove the
   secret.

The gateway can stay deployed: without the subscription it gets nothing.

## Locally

`pnpm dev` runs every team behind a local gateway on `http://localhost:8791`, with the same
paths: sign-ins come back through `/auth/return/<team>`, and simulated events from a team's
`/_dev/` go to the gateway's webhook.
