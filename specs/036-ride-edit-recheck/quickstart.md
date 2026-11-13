# Quickstart: Ride Edit Re-check

## Before building: one real request (maintainer, by hand)

The plan rests on Strava's list being newest first with 200 per request when asked without a
start date (research R3). Strava doesn't document either. With an access token of your own
account (one read from the app's budget):

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://www.strava.com/api/v3/athlete/activities?page=1&per_page=200" \
  | jq '{count: length, newest_first: ([.[].start_date] | . == (sort | reverse))}'
```

Or without a token at hand, `node scripts/strava-list-order.mjs`: it signs you in through the
browser with the app's client ID and secret and makes the same request.

Expected: `newest_first: true`, and `count: 200` for an account with at least 200 activities.
Anything else: stop and revisit the plan.

## Tests

```bash
pnpm test -- recheck          # run size, order, handler, hourly run, usage section
pnpm test -- all-locales      # the ride card's new line in ten languages
pnpm test -- teams            # allowances sum to at most 300
```

## By hand, in fake mode

```bash
pnpm dev
```

1. Open `http://localhost:8791`, connect as a sample rider who has a ride that doesn't count
   because of a pause. Open the ride's "So geht's": crop, then wait; nothing about the title.
2. On `/_dev/riders/<id>`, use "change without event" on that ride: shorter elapsed time, so it
   would count. The rider's page still shows the old verdict.
3. On `/_dev/`, press "run re-check". The rider's page shows the new figures, the ride counts, the
   Rynke rose.
4. Press "run re-check" again: nothing changes.
5. Sign in as an administrator and open the usage view: the "Ride re-check" section shows today's
   checks.

## After the release (live site)

- The usage view shows checks on the first day, about 150 per team at most, and "waited over 24 h"
  back at 0 from the second day.
- Queue operations rise by about three per check.
- Crop a ride of your own on Strava without renaming it; it follows within the day.
