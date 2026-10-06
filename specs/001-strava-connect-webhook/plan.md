# Implementation Plan: Strava Connection and Webhook Activity Intake

**Branch**: `001-strava-connect-webhook` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-strava-connect-webhook/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Members of the Strava club "TRHH Rynke Coins" connect through Strava sign-in. They
choose whether private activities are included, and membership is checked at
connect time and daily afterwards. From then on their cycling activities flow in
through Strava's webhook. A single Worker handles four things:

- **Rider pages and OAuth callback**: on connect it stores encrypted tokens and a
  minimal rider row in D1.
- **Webhook**: answers within milliseconds by putting identifier-only messages on a
  Cloudflare Queue.
- **Queue consumer** (serial): fetches the current activity state from Strava
  within an app-wide rate budget, and upserts an allow-listed set of fields.
  The past-season import, daily membership checks and deletions run through the
  same consumer.
- **Rider deletion**: deauthorization, leaving the club or pressing "disconnect"
  hard-deletes the rider, and that cascades to everything they own.

**Rider pages are German by default, with English as a second language**
(constitution v1.1.1, Language; FR-028–FR-030):

- All text comes from plain typed message catalogs (`src/i18n/messages/de.ts`,
  `en.ts`).
- The language is resolved per request: `rp_lang` cookie, then `Accept-Language`
  (English if it names only unsupported languages), then `de`.
- A no-JavaScript switcher form (`POST /lang`) sits on every rider page. It sets
  the cookie and returns the visitor to the same page.
- Outcome pages get stable GET URLs (`/notice/:id`), so the switcher can always
  return there.
- Strava brand images are chosen per language through the catalogs.

This revision updates the earlier plan for those changes. Everything else is
unchanged.

**Activity figures for points** (spec clarifications of 2026-10-06; FR-002,
FR-013): feature 003-rynke-evaluation needs three more figures per activity, so
`activities` gains `elapsed_time_s`, `is_manual` and `is_trainer`:

- They come from Strava's `elapsed_time`, `manual` and `trainer`, which are part
  of the activity data already fetched by events and the import. No new request
  or endpoint is needed.
- A new migration `0002_activity_points_figures.sql` adds them as nullable
  columns, because `0001` is already applied to the production database. `NULL`
  means "unknown", as the spec requires for rows stored before a figure existed.
  Every write sets all three, and a field Strava omits is stored as `NULL`,
  never guessed.
- The landing text `landing.dataRead` names the new figures (FR-002).
- **Re-reading stored activities** (spec edge case "Activities stored before a
  figure was added"). Production already holds activities, and `0002` leaves
  their new figures `NULL`. Each rider gets a `figures_version` marker (default 0
  from `0002`; new riders get the current version). The daily cron enqueues one
  `reread-page` chain for every connected rider who is behind, and marks them
  (research R20):
  - the chain pages the season through `GET /athlete/activities`, like the
    import, so it costs about one request per rider;
  - rows still lacking a figure afterwards get one `activity-event` refetch
    each, which fills them or deletes them.

  The re-read starts at the first cron after the deploy and needs no manual
  step. quickstart §4 lists the rollout order and the checks.

**Strava's flag** (spec Clarifications, flagged-activity question; FR-002,
FR-013):
feature 003-rynke-evaluation (FR-005g) never counts a ride Strava has flagged,
so `activities` gains `is_flagged`:

- It comes from Strava's `flagged`, which is part of both the summary (import,
  re-read) and the detailed (event) activity. No new request or endpoint.
- `0002` is already applied in production, so a new migration
  `0003_activity_flagged.sql` adds it as a nullable column (`NULL` = unknown,
  never "not flagged"). The previous code keeps working against it.
- `ACTIVITY_FIGURES_VERSION` goes from 1 to 2. Every connected rider is then
  behind, and the existing R20 re-read reads their season once more. No new
  rider column, message kind or cron step; the "still lacking a figure" check
  includes `is_flagged`.
- Strava sends no event when it flags an activity. The stored flag follows the
  next time the activity is read (an update event that changes more than the
  title, the import after a reconnect, or a re-read). There is no polling for
  it (FR-010, research R5); the spec accepts the delay.
- `landing.dataRead` names the flag (FR-002).

**Consent step and optional write access** (spec Clarifications, question raised
by feature 004-roles-and-consent; FR-002, FR-003, FR-007, FR-022, FR-025, FR-026;
constitution v2.0.0, Principle I). Feature 004 defines the consent; this feature
hosts its step in the connect flow, shows it on `/me` and deletes it with the
rider (research R21):

- **Agree before Strava**: the landing page shows the consent (what is read, what
  write access is for and that it is optional, who sees what, how to leave) above
  the Connect button. The button becomes the submit button of a `POST /connect`
  form with a required "I agree" checkbox. Without the box ticked nobody is sent
  to Strava (`/notice/consent-required`) and nothing is kept.
- **Carried through OAuth, stored on success**: the agreed consent version rides
  in the signed `rp_oauth_state` cookie. The callback stores a new rider together
  with a `consent_records` row (version, accepted at). A new athlete arriving
  without an agreed version is turned away like a refusal: revoke, nothing stored.
  `GET /connect` stays for signed-in riders only (reconnect, changing
  permissions) and carries no agreement.
- **Consent version**: `CONSENT_VERSION = 1` in `src/consent.ts`; the text is in
  the catalogs (`consent.*`). Asking riders again when a later version reads,
  writes or shows more is feature 004's (its FR-013); this feature only records
  the version so that it can.
- **Optional write access**: `/connect` asks for `activity:write` too. The rider
  may untick it on Strava's screen; the connection is unaffected and
  `riders.scope_write` records the answer. Granting or dropping it on reconnect
  changes only the recorded permissions (FR-007). The Strava client still has no
  write endpoint, and tests fail on any write call (FR-003).
- **Deletion**: `consent_records` cascades from `riders` like everything else, so
  every existing deletion path covers it (FR-022).
- **Rider page**: `/me` shows whether write access was granted, the consent
  version and date with who sees what, and a link to change permissions on Strava
  (FR-025).
- A new migration `0004_consent_and_write_scope.sql` adds the table and the
  defaulted column; the previously deployed code keeps working against it.
  Nothing is re-read from Strava (quickstart §5).

## Technical Context

**Language/Version**: TypeScript 7 (`tsc --noEmit`), ES2024 target, Cloudflare
Workers runtime (`compatibility_date` 2026-08-22, `nodejs_compat`)

**Primary Dependencies**: None at runtime. Web platform APIs only: `fetch`, Web
Crypto (AES-GCM, HMAC), `URL`, `Intl` (number/date formatting per locale, Berlin
season start). Translations are plain typed catalogs, not an i18n library (R16). Dev: wrangler, vitest +
`@cloudflare/vitest-pool-workers`, Biome (all already installed).

**Storage**: Cloudflare D1, EU jurisdiction (research R11). Tables: `riders`,
`strava_credentials`, `activities`, `consent_records`, `failed_work`,
`strava_rate_limit`
([data-model.md](data-model.md)). Migrations live in `migrations/`; applied
migrations are never edited, schema changes get a new one.

**Testing**: Vitest in workerd via `@cloudflare/vitest-pool-workers`, against local
D1 and Queue bindings. Strava is faked by spying on global `fetch`, and any
unexpected host fails the test (R12).

**Target Platform**: Cloudflare Workers (fetch, queue and scheduled handlers),
Workers Free plan, plus Workers static assets for Strava brand images (per
locale, R19).

**Project Type**: Web service (server-rendered rider pages, webhook receiver, queue
consumer, cron)

**Performance Goals**:

- Webhook acknowledged in < 2 s, target < 100 ms (SC-003).
- A new activity is stored < 5 min after upload (SC-002).
- 500 past activities imported < 24 h (SC-008); in practice 3 requests.

**Constraints**:

- Strava budget: 100 reads per 15 min and 1,000 per day, app-wide. The usage
  headers are honoured with a safety margin (R6).
- Queues free tier: 10,000 operations/day, 24 h retention. Expected use is under
  500 operations/day; R7 covers retention.
- No inline Strava calls in the webhook path.
- No GPS or coordinates are stored.

**Scale/Scope**: ≤ 10 riders (Strava capacity), a few activities per rider per day,
eight rider-facing paths (`/`, `/connect` (GET and POST), `/auth/callback`,
`/me`, `/me/disconnect`, `/logout`, `/lang`, `/notice/:id`) plus the webhook and
`/health`, one queue, one cron, two locales (`de` default, `en`) with about 85
messages each ([contracts/messages.md](contracts/messages.md)).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Consent (v2.0.0) | One explicit consent before Strava: a required checkbox under a text that says what is read, what write access is for and who sees what (FR-002, R21). Reading and sharing are required; private activities and `activity:write` are optional on Strava's screen and change nothing about taking part (R1). The accepted version and time are recorded (`consent_records`). Asking again when the consent grows is feature 004's (its FR-013), built on that record. Nothing team-visible here (FR-026). | ✅ |
| I. Minimisation | Allow-listed fields only; no GPS, polylines, coordinates or titles (data-model `activities`). Elapsed time, the manual/trainer flags and Strava's flag are in FR-013 and named on the landing page (FR-002). | ✅ |
| I. Deletion | Hard delete with cascade on deauth, disconnect, leaving the club, or 7 days stuck in `needs_reconnect` (FR-020); the cascade includes `consent_records` (FR-022). Revoking uses the stored refresh token, so deletion never depends on a working refresh. Pending work can't recreate rows (FK + rider check). D1 Time Travel keeps a 7-day restorable history that can't be disabled; it is disclosed to riders and never used to restore deleted riders (FR-022a, R15). | ✅ disclosed |
| I. Secrets | Tokens AES-GCM encrypted (R10). Secrets only via `wrangler secret` / `.dev.vars`. Tests use synthetic bindings. | ✅ |
| I. EU storage | D1 `--jurisdiction=eu` (R11). Queue messages hold IDs only. | ✅ |
| I. Purpose & brand | Data used only for this app. Official Connect button (now the consent form's submit button, image unchanged) and "Powered by Strava", unmodified, in the page language's variant where Strava ships one; `de` uses the original files until then, and a pre-deploy step checks every catalog path exists (R13, R19). | ✅ |
| I. Language preference | The picked language lives only in the `rp_lang` browser cookie. It's never in D1 or the rider record, and is disclosed on the landing page (FR-029a, R18). | ✅ |
| II. Webhook ack + queue | The handler validates and enqueues only (contracts/http-routes.md). | ✅ |
| II. Idempotency | Upserts converge to Strava's current state; duplicates and reordering are safe (R5). | ✅ |
| II. Rate limits | Header-driven budget, 429 deferral, serial consumer; the import is paged at 200 per request (R6, R8). Deferrals re-send the message (≤ 12 h delay) so they never use up its retries and never drop work. | ✅ |
| II. Capacity | Designed for ≤ 10 riders. "Team full" handled (R14). | ✅ |
| II. No polling | Activities are never polled. The daily club-membership check is a scheduled Strava lookup (≤ 20 requests/day); see Complexity Tracking. The re-read after a figure is added runs once per rider, not periodically (R20). A flag Strava sets later follows on the next read; it is never polled for. | ✅ justified |
| III. Rider content | `activity:write` is requested but nothing is written: the Strava client has no write endpoint, and the fake Strava fails any write call (FR-003). A rider stops future description edits by reconnecting without write access (feature 004, FR-016). | ✅ n/a |
| IV. Serverless, minimal deps | Workers + D1 + Queues + cron; no new runtime dependency. i18n uses typed catalogs and built-in `Intl`, not a library (R16). | ✅ |
| IV. Free tier | Queues, cron and D1 are all within free limits (see Constraints). | ✅ |
| IV. Recomputable points | No points yet. Stored activity data is the input future rules will recompute from. | ✅ n/a |
| V. Test-first, Strava mocked | Red-green per task; fake Strava, local bindings only (R12). Locale resolution, catalog parity, switcher and German-default rendering each get a failing test first. | ✅ |
| Language: German by default | Every rider page, button, status, notice, error page and the privacy text resolves to `de` unless the visitor picks English or their browser prefers it (R17). Strava's approval screen is outside the app's control. No Strava description block, notifications or other rider-facing output exist in this feature. | ✅ |
| Language: translation strings | No rider-facing copy in templates or logic; everything comes from `src/i18n/messages/<locale>.ts` by message ID (contracts/messages.md). A pseudo-locale test catches hard-coded text (R18). `de` is the source catalog every locale must match and the language when the browser states no preference (R17). | ✅ |
| Language: new locale = strings only | Add a catalog file and register it in `src/i18n/catalogs.ts`. Switcher, resolution and validation iterate over the registry; no page or processing logic changes (FR-030, R16). | ✅ |
| Language: English for developers | Code, identifiers, logs, schema, JSON fields, test names, commits and these docs are English. Webhook and health responses aren't catalogued. | ✅ |
| Language: Strava assets | German variant where Strava provides one, otherwise Strava's original; never re-lettered (R19). | ✅ open: German variant availability unconfirmed |
| Language: tests assert German | Page tests assert the German texts from contracts/messages.md; only explicit English-locale tests assert English. | ✅ |

**Post-design re-check (after Phase 1)**: still passing.

- The data model adds one field beyond the spec's FR-013 list:
  `activities.is_private`. It is needed to honour FR-007 (removing private
  activities when consent narrows), so it supports Principle I rather than
  conflicting with it.
- Analysis remediation (2026-10-06) adds `riders.reconnect_requested_at` and
  `failed_work.first_failed_at`/`failures`, makes `failed_work.message` unique,
  puts the season start (`after`) into `import-page` messages, and adds the
  `delete-rider` reason `reconnect-expired`. Rate-limit deferrals are now
  re-sends instead of `retry()`. No new table, route or dependency.
- The language revision adds no table, column or runtime dependency. It adds one
  cookie (`rp_lang`) and two routes (`POST /lang`, `GET /notice/:id`).
- Callback and disconnect outcomes now redirect to `/notice/:id` instead of
  rendering inline with 400/502/503 statuses. This is a deliberate contract change
  (R18) that keeps every page reachable by the switcher. The spec sets no status
  codes for these pages.
- The activity-figures revision adds three columns to `activities`
  (`elapsed_time_s`, `is_manual`, `is_trainer`), all listed in FR-013 and
  disclosed by FR-002, so minimisation still holds. The one-time re-read
  (R20) adds the rider column `figures_version`, the message kind
  `reread-page` and a fourth cron step. It uses only endpoints already in
  contracts/strava-api-usage.md, and it isn't polling: each rider is read once
  per figure added, not periodically. It costs about one request per rider,
  and the rate-limit rules apply unchanged. No new table, route or dependency.
- The Strava-flag revision adds one column, `activities.is_flagged`, listed in
  FR-013 and disclosed by FR-002, and raises `ACTIVITY_FIGURES_VERSION` to 2.
  It reuses the R20 re-read unchanged: no new rider column, message kind, cron
  step, endpoint, table, route or dependency. Migration `0003` only adds a
  nullable column, so the previously deployed code keeps working while CI
  applies it before publishing.
- The consent revision adds one table, `consent_records` (cascading from
  `riders`), and one column, `riders.scope_write` (`NOT NULL DEFAULT 0`), both
  in migration `0004`. Old code never names either, and its rider deletes
  cascade into the new table, so it keeps working while CI applies `0004`
  before publishing. It adds `POST /connect`, narrows `GET /connect` to
  signed-in riders and adds the notice `consent-required`. Notice retry links
  now point to `/`, where the consent is. Consent records hold a version
  number and a time, nothing from Strava, so minimisation still holds. No new
  Strava endpoint, message kind, cron step or dependency.

## Project Structure

### Documentation (this feature)

```text
specs/001-strava-connect-webhook/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── http-routes.md
│   ├── queue-messages.md
│   ├── strava-api-usage.md
│   └── messages.md          # message IDs with German + English text
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
migrations/
├── 0001_init.sql            # riders, strava_credentials, activities, failed_work, strava_rate_limit
├── 0002_activity_points_figures.sql  # activities: elapsed_time_s, is_manual, is_trainer; riders: figures_version
├── 0003_activity_flagged.sql         # activities: is_flagged
└── 0004_consent_and_write_scope.sql  # consent_records; riders: scope_write

public/
└── strava/                  # Strava brand assets (static assets binding), unmodified
    ├── en/                  # connect-with-strava.svg, powered-by-strava.svg
    └── de/                  # German variants, only if Strava provides them (R19)

src/
├── index.ts                 # fetch / queue / scheduled entry points
├── config.ts                # typed env access, cycling sport types, season start
├── consent.ts               # CONSENT_VERSION (R21)
├── i18n/
│   ├── messages/
│   │   ├── de.ts            # source catalog: defines MessageId
│   │   └── en.ts            # typed as Catalog → tsc enforces key parity
│   ├── catalogs.ts          # registry { de, en }, Locale, DEFAULT_LOCALE, FOREIGN_LOCALE
│   ├── resolve.ts           # resolveLocale(request, catalogs): cookie > Accept-Language > en > de
│   └── i18n.ts              # createI18n(locale, catalogs): t, tHtml, formatNumber, formatDate
├── http/
│   ├── router.ts            # path → handler; resolves the locale once per request
│   ├── html.ts              # escaping html`` template + layout (lang attr, switcher, attribution)
│   ├── session.ts           # signed session + OAuth state cookies
│   ├── landing.ts           # GET /, with the consent form
│   ├── auth.ts              # POST /connect, GET /connect, GET /auth/callback
│   ├── me.ts                # GET /me (incl. consent), disconnect, logout
│   ├── lang.ts              # POST /lang (switcher), rp_lang cookie, next allow-list
│   ├── notice.ts            # GET /notice/:id outcome pages
│   └── webhook.ts           # GET/POST /strava/webhook/:secret
├── strava/
│   ├── client.ts            # the endpoints in contracts/strava-api-usage.md
│   ├── tokens.ts            # refresh-before-use, rotation, revoke
│   ├── rate-limit.ts        # budget from headers, next-window calculation
│   └── activity.ts          # Strava response → allow-listed activity record, ACTIVITY_FIGURES_VERSION
├── work/
│   ├── messages.ts          # queue message types + validation
│   ├── consumer.ts          # common rules (rider check, budget, retries, failed_work)
│   ├── activity-event.ts
│   ├── activity-page.ts     # one list page + scope rule, shared by import and re-read
│   ├── import-page.ts
│   ├── reread-page.ts       # one-time re-read when FR-013 gains a figure (R20)
│   ├── check-membership.ts
│   ├── delete-rider.ts
│   └── scheduled.ts         # daily membership fan-out, failed_work re-enqueue, re-read fan-out
├── db/
│   ├── riders.ts
│   ├── activities.ts
│   ├── consents.ts          # record and read consent_records
│   ├── failed-work.ts
│   └── rate-limit.ts
└── crypto/
    ├── encrypt.ts           # AES-256-GCM token encryption
    └── sign.ts              # HMAC sign/verify

test/
├── setup.ts                 # apply D1 migrations
├── support/
│   ├── fake-strava.ts       # fetch spy routing to synthetic Strava responses
│   └── fixtures.ts          # synthetic athletes/activities/clubs
├── unit/                    # rate-limit, activity mapping, crypto, session, message validation,
│                            # locale resolution, catalog parity, t/tHtml/formatting
└── integration/             # routes, webhook → queue → D1, cron, deletion, switcher,
                             # German-default/English rendering, hard-coded-copy guard
```

**Structure Decision**: a single Worker project using the existing `src/` and `test/`
layout. It is split by role into HTTP, the Strava client, queue work, and DB
access, so that the pure parts (rate-limit maths, activity mapping, crypto) can be
unit-tested without bindings. `src/i18n/` holds the message catalogs and pure
locale logic. Handlers receive a per-request `I18n` object from the router and
never import a catalog directly. `Ctx` gains `catalogs` (default `CATALOGS`), so
tests can inject a pseudo-locale. `wrangler.jsonc` gains bindings for D1 (`DB`), the
queue producer and consumer (`WORK_QUEUE`), the cron trigger, static `assets`, and
`vars` (`STRAVA_CLUB_ID`, `SEASON_START_DATE`, `STRAVA_SUBSCRIPTION_ID`).
`.dev.vars.example` gains `TOKEN_ENCRYPTION_KEY` and `SESSION_SIGNING_KEY`.
Afterwards, regenerate `worker-configuration.d.ts` with `pnpm types`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Daily scheduled Strava lookup (club membership), next to Principle II's "reacts, does not poll" | The spec requires disconnecting riders who leave the club (FR-004a). Strava sends no club-membership events, so a periodic check is the only way. | Checking on each activity event costs more requests and misses inactive riders. Dropping the leave rule contradicts the clarified spec. Cost is ≤ 20 requests/day of a 1,000/day read budget, and activities are still never polled. |
| `failed_work` table re-enqueued by cron (beyond plain queue retries) | Queues on the free plan retain messages for only 24 h, while SC-005 requires no activity to be lost during longer Strava outages. | A dead-letter queue has the same 24 h retention. A paid plan contradicts Principle IV's free-tier default. |

## Open questions

- **German Strava brand assets** (FR-001, R19): Strava's guidelines page doesn't
  say whether its button and logo downloads include German variants. The
  maintainer checks when downloading (quickstart §3 step 5). Until a German
  variant is confirmed, `de` points at Strava's official English files, as the
  constitution allows, and FR-001's "variant matching the page language" isn't
  fully met for German. The fix is either a spec note or a request to
  developers@strava.com. No code change is needed either way, because the asset
  path is a catalog entry.
- **Browsers naming only unsupported languages** (FR-029): resolved in the spec on
  2026-10-06 — `da` gets English, `da,de;q=0.5` gets German, and only a missing or
  empty preference falls back to German (R17).
- **Returning riders tick the box again** (feature 004, US1 scenario 6; R21):
  resolved by the maintainer on 2026-10-07 — accepted. Before Strava the app
  can't tell a returning rider from a new one, so a rider whose 30-day session
  expired ticks the consent box again to sign in. No new record is written for a
  version they already accepted; "not asked again" means no re-consent step after
  signing in. A separate sign-in link was rejected because it would send unknown
  visitors to Strava before they agreed (FR-002).
- **Deletion confirmation outside the app** (feature 004, FR-011, F-4): resolved
  by the maintainer on 2026-10-07 — accepted as is. The disconnect button shows
  the confirmation (`/notice/deleted`) and the landing text promises it only
  there. Revoking on Strava or leaving the club deletes the data too, but the app
  stores no email and confirms nothing in that case.
