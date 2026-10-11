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

1. **Upgrade to 10 athletes** in the [API settings](https://www.strava.com/settings/api),
   if not done yet.
2. **Reach capacity.** Strava only reviews apps approaching capacity; in practice,
   apply once 10 riders are connected. The API settings page shows whether the app
   qualifies.
3. **Check the API usage.** Strava treats low user numbers with high request counts
   as inefficient. Confirm the app still uses webhooks, not activity polling, and
   that backfills honour the `X-RateLimit-*` headers (constitution Principle II).
4. **Check the [API Agreement](https://www.strava.com/legal/api)** (last updated
   2026-06-01) against the app, especially consent before a rider's data is shown
   to others (feature 004, FR-010) and deletion (feature 001, FR-022).
5. **Check the [brand guidelines](https://developers.strava.com/guidelines):** the
   official "Connect with Strava" button and "Powered by Strava" logo, unaltered, in
   German and English.
6. **Take screenshots** of the "Connect with Strava" button and every page showing
   Strava data or data derived from it. Use `pnpm dev` (synthetic riders), never real
   riders' data. Today:
   - `/` (landing, "Connect with Strava")
   - `/me`, `/me/rides`, `/me/settings`
   - `/team` (team leaderboard)
   - `/organiser`, `/organiser/riders`, `/organiser/events`
   - a push notification with new Rynke (feature 010; derived data)

   Re-check this list against `src/http/router.ts` before applying: a page added
   after the review that shows Strava data may need another review.
7. **Submit the [Developer Program form](https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8)**
   with the screenshots, the app's purpose (a charity team's training points, under
   100 riders, consent-based team leaderboard), and the expected number of athletes.
8. **Record the outcome** (date, granted capacity, new rate limits, or the refusal
   and its reason) in feature 004's spec (F-5) and in the constitution's Technology
   Constraints, and close #31.
9. **After approval,** connect an 11th rider and check that the "team is full"
   handling (R14) still matches Strava's real response.
