# Implementation Plan: Rynke Coin Look and Fun Graphics

**Branch**: `012-rynke-fun` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-rynke-coin-fun/spec.md`

## Summary

The Rynke coin shows wherever the app talks about Rynke. On top of that, the
Overview celebrates new Rynke once. The look follows the Claude Design mock-up
"RynkePoints Coin Explorations" that the maintainer approved ("full fun version").
The same change brings the Team Rynkeby colours: new values for feature 011's
design tokens ([011 contracts/design-tokens.md](../011-mobile-app-shell/contracts/design-tokens.md)).

- **Coin (FR-006)**:
  - One inline SVG sprite (`src/http/coin.ts`) with three symbols. `coin-front`
    is the orangutan in a yellow helmet inside the chain ring. `coin-back` shows
    Hamburg to Paris: Elbphilharmonie, crane, Elbe and Eiffel Tower. `coin-mini`
    is the rim with the chain ring, for sizes under 32 px.
  - The layout includes the sprite once per page, and each coin is a `<use>`.
    Pages with many coins stay small (SC-002), and no other origin is involved
    (FR-005).
  - The colours come from the `--rp-coin-*` tokens. These are the same in both
    schemes, because the coin is printed artwork with its own gold rim. That
    rim keeps it readable on the dark surface.
- **Coins with the totals (US1, FR-001)**:
  - The coin sits in the wordmark. On phones inside the shell only the coin
    shows.
  - The Overview tab icon is the coin; it replaces 011's gauge icon.
  - The hero card holds the coin, the greeting and both totals.
  - Each gauge shows its coin in the caption and a row of ten coins:
    `floor(percent / 10)` are collected and the rest are empty slots.
  - The chips for what is missing carry mini coins.
- **Celebration (US2, FR-002, FR-007)**:
  - The Overview compares the totals with the rider's `rynke_seen` row. If
    either total rose, it shows an `<aside class="celebrate" role="status">`
    with the amount, and two mini coins drop in (`coin-drop`).
  - Under `prefers-reduced-motion`, the celebration shows without the
    animation.
  - It shows nothing on the first visit (no row yet), or when the totals stay
    the same or fall.
  - The row is written only on `GET` and only when the totals changed. A `HEAD`
    can't use up the celebration, and an unchanged visit writes nothing.
- **Illustrations (US3, FR-003)**:
  - The landing page shows the coin hero with a tagline.
  - The empty Rides list shows a large coin.
  - The Team placeholder shows the large reverse.
  - Rides that count show a mini coin.
  - The qualified verdict shows the reverse.
- **Copy**: emoji (🦧🍌🗼🪙🚴🎉) go into existing strings in both catalogs.
  New keys are `hero.training`, `hero.team`, `celebrate.training`,
  `celebrate.team`, `celebrate.both` and `landing.tagline`.

## Technical Context

As in feature 011: TypeScript on Cloudflare Workers with server-rendered pages,
Vitest in workerd and no new dependencies. Storage is one new D1 table
([data-model.md](data-model.md)).

## Constitution Check

- **I Privacy**:
  - `rynke_seen` holds two numbers per rider that the app already computes. It
    is deleted with the rider (`ON DELETE CASCADE`).
  - There is no new Strava scope or request, so there is no new consent
    version.
- **II Webhooks and queue**: untouched.
- **III Descriptions**: untouched.
- **IV Simplicity**: one sprite and CSS. There is no image file, font or
  client script.
- **V Tests first**: [quickstart.md](quickstart.md).

The Overview's write is a deliberate exception to feature 005 SC-004, recorded
as FR-007. The read-only tests now count every table except `rynke_seen`.

## Project Structure

```text
migrations/0010_rynke_seen.sql   new table
src/db/rynke-seen.ts             readSeen, writeSeen
src/http/coin.ts                 sprite, coin(), miniCoin()
src/http/html.ts                 sprite in the layout, wordmark, theme colours
src/http/style.ts                tokens (colours, coin), hero, coin rows, celebration
src/http/icons.ts, shell.ts      coin as the Overview icon
src/http/sections/overview.ts    hero, celebration, seen totals
src/http/rider-sections.ts       chips, gauges, verdict, rides list
src/http/sections/team.ts        placeholder coin
src/http/landing.ts              landing hero
src/i18n/messages/{de,en}.ts     new keys, emoji
public/app.js, manifest          theme colours
```
