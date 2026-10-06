# Quickstart: validating Strava connection and webhook intake

How to prove the feature works. Details live in
[contracts/](contracts/) and [data-model.md](data-model.md); this file only lists
what to run and what to expect.

## 1. Automated validation (no Strava, no Cloudflare account)

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

All tests use a migrated local D1, a local queue, synthetic bindings from
`vitest.config.ts`, and a fake Strava. A test fails if any request reaches a real
host.

Pages are asserted in German unless the row says otherwise (constitution,
Language). Message texts are in [contracts/messages.md](contracts/messages.md).

| Scenario (spec) | Expected test outcome |
|---|---|
| US1 connect, member, both scopes | rider and credentials rows exist, tokens are not plaintext, session cookie set, `import-page` p.1 enqueued |
| US1 rider unticks private | rider has `scope_read_all=0`; `/me` says „Nur geteilte Aktivitäten …“ |
| US1 refusal / missing `activity:read` | no rows in any table; `303 /notice/denied` with the explanation |
| US1 non-member | revoke called on fake Strava; no rows; `303 /notice/not-member` with the club link |
| US1 token exchange 403 | `303 /notice/team-full` („Das Team ist im Moment voll“); no rows |
| US1 reconnect narrowing scope | private activities removed, public kept, still one rider row |
| US2 create / update(type) / delete | activity row inserted / refreshed / removed |
| US2 duplicate + reordered events (SC-004) | exactly one row per existing cycling activity, none for deleted |
| US2 title-only update | no outbound call recorded |
| US2 run activity | no row |
| US2 unknown athlete / foreign subscription / wrong path secret | no outbound call, no rows; 200 / 200 / 404 |
| Webhook ack (SC-003) | `POST /strava/webhook/:secret` returns without any outbound fetch |
| Rate limit headers near limit / 429 | message retried with delay to next window; no extra call |
| Transient errors past last attempt | `failed_work` row; daily cron re-enqueues it |
| US3 deauth event | rider, credentials, activities, failed_work all gone |
| US3 disconnect button | revoke called, all rows gone, session cleared, `303 /notice/deleted` (7-day backup sentence); foreign `Origin` → 403 |
| US3 left club (cron → check → delete) | revoke called, all rows gone; inconclusive check (503) keeps rider |
| US4 `/me` | only own 20 newest activities, German number/date formats (`42,2 km`, `06.10.2026`); signed-out → redirect `/` |
| Season import | 450 synthetic activities → 3 pages, all cycling ones stored, `import_status=done` |
| Catalog parity (FR-028, SC-010) | `de` and `en` have identical keys, no empty values, identical placeholders; a `sport.*` message for every cycling type |
| Locale resolution (FR-029) | no header / `*` / `de-DE,en;q=0.5` / `da,de;q=0.5` → `de`; `en-US,en;q=0.9,de;q=0.8` / `da` → `en`; unknown `rp_lang` ignored |
| German default rendering (SC-010) | every rider page with no `Accept-Language` → `<html lang="de">`, `Content-Language: de`, German text, German Strava button `src`/`alt` |
| English rendering (SC-010) | same pages with `Accept-Language: en` → English text and the English button |
| Switcher (FR-029a, SC-011) | every rider page has the `/lang` form listing Deutsch and English; `POST /lang` sets `rp_lang` and `303`s to the same page; the cookie beats `Accept-Language`; a foreign `next` → `/`; a foreign `Origin` → 403; no D1 write |
| No hard-coded copy (FR-028, FR-030) | with an injected pseudo-locale, every visible text node on every rider page comes from the catalog, and the switcher lists the extra locale |

## 2. Local manual run against the real Strava (maintainer only)

Uses your own Strava app in its 1-athlete capacity, i.e. only your own data.

1. Fill `.dev.vars` (gitignored) from `.dev.vars.example`: Strava client
   ID/secret, `STRAVA_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENCRYPTION_KEY`
   (`openssl rand -base64 32`), `SESSION_SIGNING_KEY` (`openssl rand -base64 32`).
2. In the Strava app settings, set the authorization callback domain to
   `localhost`.
3. `pnpm wrangler d1 migrations apply rynke-points --local`, then `pnpm dev`.
4. Open `http://localhost:8787/`, connect, untick "private activities" once and
   connect again.
   - Expect `/me` to reflect the level each time.
   - Expect your season rides to appear after the import.
   - Expect the pages in German, unless your browser prefers English over German.
     Use the language switcher on `/` and on `/me`. The page changes language in
     place, and the choice survives a browser restart. Deleting the `rp_lang`
     cookie restores the browser default.
5. Webhooks need a public URL. Skip them locally, or use a temporary tunnel and a
   test subscription you delete afterwards.

## 3. First production setup (manual, maintainer runs each step)

These touch production resources and are never run by tooling (constitution,
Development Workflow).

1. `pnpm wrangler d1 create rynke-points --jurisdiction=eu`. If rejected, use
   `--location=weur` instead (research R11). Put the ID in `wrangler.jsonc`.
2. `pnpm wrangler queues create rynke-points-work`.
3. `pnpm wrangler d1 migrations apply rynke-points --remote`.
4. `pnpm wrangler secret put` for `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
   `STRAVA_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENCRYPTION_KEY` and `SESSION_SIGNING_KEY`.
5. Download the official "Connect with Strava" button and "Powered by Strava" logo
   from Strava's brand guidelines (`1.1-Connect-with-Strava-Buttons.zip`,
   `1.2-Strava-API-Logos.zip`) into `public/strava/en/`.
   - If the downloads contain German variants, put them in `public/strava/de/`.
   - Otherwise, point the `brand.*.src` entries in `src/i18n/messages/de.ts` at
     the `en/` files (research R19). Never re-letter the images yourself.
6. Set `SEASON_START_DATE` in `wrangler.jsonc`, then `pnpm deploy`.
7. Create the webhook subscription (`POST /api/v3/push_subscriptions` with
   `callback_url=https://<host>/strava/webhook/<verify token>`). Put the returned
   ID into `STRAVA_SUBSCRIPTION_ID` and deploy again.
8. Smoke test:
   - connect yourself and upload a short ride; it appears on `/me` within 5 minutes
     (SC-002);
   - delete it; it disappears;
   - revoke the app in Strava settings; `wrangler d1 execute rynke-points --remote
     --command "SELECT COUNT(*) FROM riders"` shows your row gone within 1 hour
     (SC-006).
9. When the second rider connects, check that the capacity behaviour matches
   research R14. If Strava's response differs, adjust the check.

## Inspecting failures

```bash
pnpm wrangler d1 execute rynke-points --remote \
  --command "SELECT id, athlete_id, last_error, failed_at FROM failed_work"
```

## Restoring from Time Travel (disaster recovery only)

A restore can bring back riders who were deleted after the restore point
(research R15). After restoring, wait for the next daily membership check, then
delete every rider it marked `needs_reconnect` whose Strava access is refused.
