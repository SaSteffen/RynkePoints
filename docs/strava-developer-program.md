# Strava Developer Program: more than 10 riders

How RynkePoints gets permission from Strava to connect more than 10 athletes. This
is the manual maintainer step of feature 004, User Story 5 and F-5
([spec](../specs/004-roles-and-consent/spec.md)), tracked in
[#31](https://github.com/SaSteffen/RynkePoints/issues/31).

Checked against Strava's [Getting Started](https://developers.strava.com/docs/getting-started/)
and [Rate Limits](https://developers.strava.com/docs/rate-limits/) pages on
2026-10-10.

## Capacity stages

| Stage | Athletes | Read limit (15 min / day) | Overall limit (15 min / day) | How to get there |
|---|---|---|---|---|
| Single-player mode | 1 (the developer) | 100 / 1,000 | 200 / 2,000 | Default for a new app |
| Upgraded | 10 | 200 / 2,000 | 400 / 4,000 | Self-serve, in the [API settings](https://www.strava.com/settings/api) |
| Reviewed | Granted by Strava | Set by Strava | Set by Strava | Developer Program review (below) |

Until the review is approved, Strava refuses to authorise the 11th athlete. The app
then shows feature 001's "team is full" notice (`/notice/team-full`, research R14).

Strava raises limits only for apps approaching capacity, at its discretion, with no
stated time limit, and without a guarantee (API Agreement Policy §3.6). Creating an
app needs a Strava subscription; Strava doesn't say whether the review does.

## Procedure

Most of the material comes from one command:

```bash
pnpm exec playwright install chromium   # once
pnpm strava:review --remote
```

It writes `strava-review/<date>/` (ignored by git):

- `screenshots.pdf`, for the form's single "App Images" upload (step 6);
- `application.md`, with an answer for every form field (step 7), the checks
  that stay manual, and the screenshots. Technical details (production
  numbers for steps 2 and 3, scopes, Strava requests, brand assets) and the
  German screenshots are folded away there.

`--remote` only reads production's D1 through Wrangler's login; without it the
production numbers are left out. The run fails when a page route in
`src/http/router.ts` has no screenshot, or a Strava brand image is missing.

1. **Upgrade to 10 athletes** in the [API settings](https://www.strava.com/settings/api),
   if not done yet.
2. **Reach capacity.** Strava only reviews apps approaching capacity; in practice,
   apply once 10 riders are connected. The API settings page shows whether the app
   qualifies.
3. **Check the API usage.** Strava treats low user numbers with high request counts
   as inefficient. Confirm the app still uses webhooks, not activity polling, and
   that backfills honour the `X-RateLimit-*` headers (constitution Principle II).
4. **Check the [API Agreement](https://www.strava.com/legal/api)** (last updated
   2026-06-01) and the [API Policy](https://www.strava.com/legal/api_policy)
   against the app, especially consent before a rider's data is shown
   to others (feature 004, FR-010) and deletion (feature 001, FR-022).
5. **Check the [brand guidelines](https://developers.strava.com/guidelines):** the
   official "Connect with Strava" button and "Powered by Strava" logo, unaltered, in
   German and English.
6. **Take screenshots** of the "Connect with Strava" button and every page showing
   Strava data or data derived from it, with synthetic riders only, never real
   riders' data. `pnpm strava:review` takes them in fake mode
   (`e2e/strava-review.review.ts`), German and English, phone and desktop;
   the PDF has the English ones, which is all the form asks for:
   - `/` (landing, "Connect with Strava") and `/notice/team-full`
   - `/me`, `/me/rides`, `/me/settings`, `/me/disconnect`
   - `/team` (team leaderboard)
   - `/organiser` and one event, `/organiser/riders` and one rider
   - a push notification with new Rynke (feature 010; derived data), as a
     mock-up of the phone's notification with the app's real text

   A page added to `src/http/router.ts` fails the run until it is screenshotted
   there. A page added after the review that shows Strava data may need another
   review.
7. **Submit the [Developer Program form](https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8)**
   with the answers from `application.md` and `screenshots.pdf`. Keep it short
   and easy for the reviewer: the details stay ready in case Strava asks.
8. **Record the outcome** (date, granted capacity, new rate limits, or the refusal
   and its reason) in feature 004's spec (F-5) and in the constitution's Technology
   Constraints, and close #31.
9. **After approval,** connect an 11th rider and check that the "team is full"
   handling (R14) still matches Strava's real response.
