# Contract: HTTP Routes

**Feature**: [../spec.md](../spec.md) | **Research**: R1, R2, R9

New and changed routes. Everything else in the route contracts of features 001,
004, 005 and 010 is unchanged.

## Section routes (new or changed)

| Route | Section | Reads | Notes |
|---|---|---|---|
| `GET /me` | Overview | rider, consent, `readRiderView` page 1 | Without `page` only; see below |
| `GET /me/rides` | Rides | rider, consent, `readRiderView` page `N` | `?page=N` as in feature 005; an invalid page behaves as 005 defines |
| `GET /team` | Team | rider, consent | Placeholder; reads no other rider |
| `GET /me/settings` | Settings | rider, consent, current consent record | |

All four go through `shellPage()` (R1), in this order:

1. No valid session, or the rider is gone → `302 /`.
2. The rider hasn't agreed to the current consent → `200` with the consent gate
   (feature 004) on this URL. The gate has no navigation bar, and its forms
   carry `next` = this path, including `?page=N` (R9).
3. Otherwise → `200` with the section in the shell layout.

`HEAD` behaves like `GET`, and session renewal (feature 010) applies to all four.

## `GET /me?page=…` (changed)

If the query has a `page` parameter, whatever its value, the response is
`301 Location: /me/rides?page=<value as given>`. It doesn't read the session or
D1. `/me` without `page` is the Overview.

## `GET /me/disconnect` (changed)

"Cancel" links to `/me/settings` (FR-015). Otherwise unchanged; it's a public
style page without the navigation bar.

## `POST /lang` (changed)

`safeNext()` also accepts `/me/rides`, `/me/rides?page=N` (N from 1 to 9999, as
today), `/me/settings` and `/team`. Every other rule is unchanged.

## `POST /me/consent` (changed)

The new optional form field `next` decides where the response goes:
`303 Location: safeNext(next)`. If `next` is missing or not allowed, it goes to
`/me` as today. Every other check is unchanged.

## `POST /connect` and `GET /auth/callback` (changed)

`POST /connect` reads an optional `next` field and passes it through `safeNext()`.
The OAuth state cookie's signed value becomes `<state>:<consentVersion>:<next>`.
`next` is always one of `safeNext`'s paths, and none of them contains `:`, so it
parses unambiguously.

`readOAuthState` accepts the old two-part value as `next = "/me"`, so a sign-in
started before the deploy still finishes.

On success the callback answers `302 <next>` instead of `302 /me`. Every error
outcome is unchanged.

## Static assets (changed)

- `public/manifest.webmanifest`: `theme_color` and `background_color` become
  `#fff8f6` (R12).
- `public/app.js`: see [client.md](client.md).
- `public/strava/en/powered-by-strava-white.svg` is new. The maintainer adds it
  before deploying (R13).
- `public/sw.js`: unchanged. The notification still opens `/me`, which is the
  Overview (FR-008).
