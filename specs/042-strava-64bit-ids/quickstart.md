# Quickstart: Strava 64-bit IDs

## Tests

```bash
pnpm test        # the D1 guard fails any query that returns an ID as a number
pnpm test:e2e    # fake mode, with sample riders whose IDs are above 2^53
```

## By hand, in fake mode

1. `pnpm dev`, open Hamburg's site, sign in as a sample rider with a large ID (the sample list
   marks them), and see their rides, Rynke and badges.
2. Let the fake Strava send a new ride for that rider; it arrives through the gateway and is
   listed with its exact ID (the link to Strava on the organiser's rider view carries every
   digit).
3. Delete the ride on the fake Strava; it disappears.
4. Sign out and in again; disconnect; the rider and their rows are gone.

No request to the real Strava is needed: the app reads `id`, which every response and event has
today (research R1).
