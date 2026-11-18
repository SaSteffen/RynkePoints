# Quickstart: Administrators on Every Team's Site

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## 1. Before building the reading part: two tokens for one person (manual, real Strava)

Settles research R1. The maintainer runs it with their own Strava account; tests never do (Principle
V). It takes a handful of requests from the app's budget and about six hours of waiting for step 4.
Tokens go nowhere but this terminal: not into a file in the repository, not into an issue.

Use the Strava app from `.dev.vars` (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`). If that is the
production app, step 5 may end your own connection to your team; reconnect there afterwards.

1. **Authorize twice.** Open this in the browser, approve, and copy `code` from the address Strava
   sends you to (the page itself won't load; `localhost` is allowed for every app):

   ```text
   https://www.strava.com/oauth/authorize?client_id=<id>&redirect_uri=http://localhost/x&response_type=code&scope=read,activity:read&approval_prompt=force
   ```

   Exchange it:

   ```bash
   curl -s -X POST https://www.strava.com/oauth/token \
     -d client_id=<id> -d client_secret=<secret> -d code=<code> -d grant_type=authorization_code
   ```

   Note `access_token` and `refresh_token` as **A1/R1**. Repeat the whole step for **A2/R2**.
2. **Same token?** Record whether R2 equals R1.
3. **Did the second exchange break the first?** Right away:

   ```bash
   curl -s -H "Authorization: Bearer <A1>" https://www.strava.com/api/v3/athlete | head -c 80
   curl -s -X POST https://www.strava.com/oauth/token -d client_id=<id> -d client_secret=<secret> \
     -d grant_type=refresh_token -d refresh_token=<R1>
   ```

   Either one refused (401 / 400): **outcome C**. Stop here.
4. **Does a refresh at one break the other?** About five and a half hours after step 1 (a refresh
   only renews within the last hour), refresh with R1 as in step 3 and note the new refresh token
   R1'. Then refresh with R2. Refused: **outcome B**. Works: **outcome A**.
5. **Optional, for the record: does a revoke reach the other?**

   ```bash
   curl -s -X POST https://www.strava.com/oauth/revoke -u <id>:<secret> -d token=<R2>
   ```

   Then refresh with R1'. The feature doesn't depend on the answer (R5).

Write the outcome (A, B or C, and step 5's answer) into research R1 before `/speckit-tasks`, or
tell whoever runs it. Outcome C sends the spec back to the user.

## 2. Fake mode

```bash
pnpm dev
```

- Open Europe's site, agree to the consent and sign in through the fake Strava as Europe's sample
  guest. Expected: signed in, with Orga and Admin in the navigation; the organiser and admin views
  open; no "one team" notice.
- Open the Team views and the Orga riders list: the guest is in none of them, and the figures match
  those of a fresh `pnpm dev` with the guest's line removed from the guest list before seeding.
- Open your own Rynke, rides and badges as the guest: filled from the sample rides (outcome A).
- Admin › Riders: the guest appears in the guest group, marked.
- Remove the guest from the list:

  ```bash
  pnpm wrangler d1 execute DB --local --env europe --persist-to .wrangler/fake-state \
    --command "DELETE FROM guests WHERE athlete_id = <sample guest id>"
  ```

  Reload: you are signed out. After the next daily run, the guest's row is gone.

## 3. Tests

Run the new and touched files only; CI runs everything:

```bash
pnpm test test/integration/guest-*.test.ts test/integration/callback.test.ts \
  test/integration/admin-riders.test.ts test/integration/disconnect.test.ts \
  test/integration/admin-remove.test.ts test/integration/membership-check.test.ts
```

What they prove:

| Test | Proves |
|---|---|
| Team counts with and without a guest | every team page, organiser and admin figure and the album data byte-identical (FR-007, SC-002) |
| Guest sign-in | let in without the club, no club request, Orga and Admin open, no "one team" notice (FR-003, FR-004, FR-008) |
| Removed from the list | next request is a visitor's; daily run deletes, no revoke request (FR-004) |
| No revoke | the fake Strava sees no `/oauth/revoke` for a guest's disconnect, removal or expiry, nor for any refusal at sign-in (FR-009) |
| Club check | guests get no `check-membership` (FR-006) |
| Admin riders | the guest only in the guest group, marked (FR-008) |
| Own pages | every rider section renders for a guest (US2) |

## 4. After the release (manual, on the live sites)

1. Add your Strava ID to Europe's list (contract [guest-list.md](contracts/guest-list.md)).
2. Sign in to Europe's site; check the organiser and admin views.
3. Over the next day, check that your rides keep arriving at Hamburg (SC-003).
