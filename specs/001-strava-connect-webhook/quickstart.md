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
| US1 connected rider signs in without `activity:read` | revoke called; all their rows gone; `303 /notice/denied-deleted` (deletion + 7-day backup sentence) |
| US1 non-member | revoke called on fake Strava; no rows; `303 /notice/not-member` with the club link |
| US1 connected rider signs in, now a non-member | revoke called; all their rows gone; `303 /notice/not-member-deleted` (deletion + 7-day backup sentence) |
| US1 connected rider signs in, club check inconclusive (503) | no revoke; signed in, `302 /me`; rider kept |
| US1 token exchange 403 | `303 /notice/team-full` („Das Team ist im Moment voll“); no rows |
| US1 reconnect narrowing scope | private activities removed, public kept, still one rider row |
| US1 reconnect after `needs_reconnect` | `status=connected`, `import_status=pending`, `import-page` p.1 enqueued |
| US2 create / update(type) / delete | activity row inserted / refreshed / removed |
| US2 duplicate + reordered events (SC-004) | exactly one row per existing cycling activity, none for deleted |
| US2 title-only update | no outbound call recorded |
| US2 update with empty or unknown `updates` | activity refetched once |
| US2 run activity | no row |
| US2 unknown athlete / foreign subscription / wrong path secret | no outbound call, no rows; 200 / 200 / 404 |
| Webhook ack (SC-003) | `POST /strava/webhook/:secret` returns without any outbound fetch |
| Rate limit headers near limit / 429 | message re-sent with delay to next window (≤ 12 h) and acked, also on the last attempt; no extra call, no `failed_work` |
| Transient errors past last attempt | `failed_work` row (repeat failures update it, `first_failed_at` kept); daily cron re-enqueues it and keeps it; deleted on success or after 7 days (logged) |
| US3 deauth event | rider, credentials, activities, failed_work all gone |
| US3 disconnect button | revoke called, all rows gone, session cleared, `303 /notice/deleted` (7-day backup sentence); foreign `Origin` → 403 |
| US3 left club (cron → check → delete) | revoke called, all rows gone; inconclusive check (503) keeps rider |
| US3 `needs_reconnect` for more than 7 days (cron → delete) | revoke with the stored refresh token, no token refresh; all rows gone; 6 days → kept |
| US4 `/me` | only own 20 newest activities, German number/date formats (`42,2 km`, `06.10.2026`); signed-out → redirect `/` |
| Season import | 450 synthetic activities → 3 pages, all cycling ones stored, `import_status=done`; every page uses the `after` from the first message |
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
2. Strava always allows `localhost` and `127.0.0.1` as OAuth callback hosts, so
   the app's callback domain can stay set to the production domain (§3).
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
Development Workflow). The app is served at `https://trhh-rynke-coins.link`.

1. **Cloudflare account.** A free-plan account covers Workers, D1, Queues, cron
   triggers and static assets. Prefer a shared team email over a personal one,
   and add other maintainers under Manage Account → Members. Then
   `pnpm wrangler login`, and check the account with `pnpm wrangler whoami`.
2. **Domain.** `trhh-rynke-coins.link` must be an active zone in that account
   (its nameservers are Cloudflare's). Under DNS → Records, add only these two;
   the domain sends no mail, so they stop anyone from sending mail in its name:

   | Type | Name | Content |
   |---|---|---|
   | TXT | `@` | `v=spf1 -all` |
   | TXT | `_dmarc` | `v=DMARC1; p=reject;` |

   Don't add an A or CNAME record for the domain itself: deploying with a custom
   domain (step 8) creates it, together with the TLS certificate.
3. `pnpm wrangler d1 create rynke-points --jurisdiction=eu`. If rejected, use
   `--location=weur` instead (research R11). Put the ID in `wrangler.jsonc`.
4. `pnpm wrangler queues create rynke-points-work`.
5. `pnpm wrangler d1 migrations apply rynke-points --remote`.
6. `pnpm wrangler secret put` for `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
   `STRAVA_WEBHOOK_VERIFY_TOKEN`, `TOKEN_ENCRYPTION_KEY` and `SESSION_SIGNING_KEY`.
   - Generate fresh production values for the two keys
     (`openssl rand -base64 32`); never reuse the ones in `.dev.vars`.
   - Never change `TOKEN_ENCRYPTION_KEY` once riders exist: their stored tokens
     become unreadable and every rider has to reconnect.
7. Download the official "Connect with Strava" button and "Powered by Strava" logo
   from Strava's brand guidelines (`1.1-Connect-with-Strava-Buttons.zip`,
   `1.2-Strava-API-Logos.zip`) into `public/strava/en/`.
   - The `de` catalog points at the `en/` files by default.
   - If the downloads contain German variants, put them in `public/strava/de/` and
     switch the `brand.*.src` entries in `src/i18n/messages/de.ts` to them
     (research R19). Never re-letter the images yourself.
   - Before deploying, check that every `brand.*.src` path in every catalog
     exists under `public/`:
     `grep -ho '"/strava/[^"]*"' src/i18n/messages/*.ts | tr -d '"' | sort -u | sed 's|^|public|' | xargs ls`.
     Tests don't need these files, so nothing else catches a missing one.
8. **Attach the domain.** `wrangler.jsonc` needs:

   ```jsonc
   "routes": [{ "pattern": "trhh-rynke-coins.link", "custom_domain": true }],
   "workers_dev": false,
   "preview_urls": false
   ```

   The app then has exactly one origin. That matters because Strava accepts one
   callback domain, and the session and language cookies are per host. To serve
   `www.trhh-rynke-coins.link` too, add a Redirect Rule to the bare domain rather
   than a second custom domain.
9. Set `SEASON_START_DATE` in `wrangler.jsonc`, then `pnpm deploy`.
   `https://trhh-rynke-coins.link/health` answers `ok`.
10. **HTTPS only.** Once the domain serves the Worker, switch on SSL/TLS → Edge
    Certificates → Always Use HTTPS. All cookies are `Secure`, so signing in
    can't work over plain HTTP.
11. **Strava app settings.** Set the Authorization Callback Domain to
    `trhh-rynke-coins.link`. The OAuth callback is then
    `https://trhh-rynke-coins.link/auth/callback`.
12. Create the webhook subscription (`POST /api/v3/push_subscriptions` with
    `callback_url=https://trhh-rynke-coins.link/strava/webhook/<verify token>`).
    Put the returned ID into `STRAVA_SUBSCRIPTION_ID` and deploy again.
13. Smoke test:
    - connect yourself and upload a short ride; it appears on `/me` within 5
      minutes (SC-002);
    - delete it; it disappears;
    - revoke the app in Strava settings; `wrangler d1 execute rynke-points
      --remote --command "SELECT COUNT(*) FROM riders"` shows your row gone within
      1 hour (SC-006).
14. When the second rider connects, check that the capacity behaviour matches
    research R14. If Strava's response differs, adjust the check.

## Inspecting failures

```bash
pnpm wrangler d1 execute rynke-points --remote \
  --command "SELECT id, athlete_id, last_error, first_failed_at, failed_at, failures FROM failed_work"
```

Rows stay while the failure is open. Given-up rows (7 days after the first
failure) are deleted and show up as a "giving up" log line in the Worker logs.

## Restoring from Time Travel (disaster recovery only)

A restore can bring back riders who were deleted after the restore point
(research R15). Their Strava access is refused, so the next daily membership
check marks them `needs_reconnect`, and the cron deletes them 7 days later
(FR-020). Delete them by hand sooner if you can tell them apart.
