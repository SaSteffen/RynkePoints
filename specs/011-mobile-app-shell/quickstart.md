# Quickstart: Mobile App Shell with Sections and a Material Look

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## 1. Automated checks

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

All tests use synthetic riders. Nothing contacts Strava.

| Test file | Proves |
|---|---|
| `test/integration/sections.test.ts` (new) | `/me`, `/me/rides`, `/team`, `/me/settings`: visitor → `302 /`; rider without current consent → gate with `next` = that path and no `nav.app-nav`; agreed rider → `200`, one `nav.app-nav` with four links in order, exactly one `aria-current="page"` on the right one, no language form in the header (FR-001–FR-003, FR-007, FR-016, US1) |
| `test/integration/overview.test.ts` (new) | order notice → greeting → verdict → gauges → breakdown → rules; reconnect notice first when `needs_reconnect`; no `ol.ride-list`, `#notifications`, consent text, `/me/disconnect` link or logout form (FR-010, US1-AS1) |
| `test/integration/me-rynke.test.ts` | moves from `/me` to `/me/rides` for the ride list; card markup per [contracts/pages.md](contracts/pages.md); `details[open]` only on `ride-not-counting`; pager links `/me/rides?page=N`; 20 per page; bad `page` as in 005 (FR-012, FR-021, clarification Q5) |
| `test/integration/rides-redirect.test.ts` (new) | `/me?page=3` → `301 /me/rides?page=3`; `/me?page=x` → `301 /me/rides?page=x`; `/me` → Overview (FR-006) |
| `test/integration/team.test.ts` (new) | placeholder for a rider and for an organiser; no other rider's name or figures even with synthetic team data present (FR-013, US5) |
| `test/integration/settings.test.ts` (new) | groups in FR-014 order by id; language form `next=/me/settings`; scheme radios; `#notifications` with the switch; `settings-app` hidden; reconnect button only when `needs_reconnect`; logout form with `push_endpoint`; disconnect link (FR-014, US4) |
| `test/integration/lang-switcher.test.ts` | `next` accepts `/me/rides?page=N`, `/me/settings`, `/team`; switching from Settings lands on Settings (FR-016, US4-AS2) |
| `test/integration/consent-gate.test.ts` | `POST /me/consent` with `next=/me/settings` → `303 /me/settings`; bad `next` → `/me` (R9) |
| `test/integration/callback.test.ts` and `connect.test.ts` | `POST /connect` with `next` stores it in the state cookie; callback redirects there; an old two-part cookie still lands on `/me` (R9) |
| `test/integration/disconnect.test.ts` | "Cancel" links to `/me/settings` (FR-015) |
| `test/integration/pwa-pages.test.ts` | viewport has `viewport-fit=cover`; two `theme-color` metas; scheme script before `<style>`; the install hint on `/` and the Overview; `/offline` has the public layout and no nav (FR-039, edge case offline) |
| `test/integration/layout.test.ts` (new) | every public page has `body.public`, the header language form and no nav; every page has both Powered-by-Strava images; no inline `width` above 360 px in any page (FR-016, FR-020, FR-034) |
| `test/unit/design-tokens.test.ts` (new) | light and dark define the same token names; the contrast pairs in [contracts/design-tokens.md](contracts/design-tokens.md) hold; gauge parts differ from each other and from the track; the head script's colours equal the `surface` tokens (FR-031–FR-033, FR-035, SC-006) |
| `test/unit/style.test.ts` (new) | every control class listed in [contracts/pages.md](contracts/pages.md) has a 44 px minimum; `body` has `tabular-nums`; a `prefers-reduced-motion` block disables the transitions; no `url(` to another origin and no `@import` (FR-022, FR-036–FR-038) |
| `test/unit/manifest.test.ts` | `theme_color` and `background_color` are `#fff8f6` (FR-039) |
| `test/unit/catalogs.test.ts`, `test/integration/no-hardcoded-copy.test.ts` | all new keys in both catalogs; new markup takes all its text from them (FR-040) |

## 2. Local walk-through (`pnpm dev`)

1. Open http://localhost:8789 in Chrome with device emulation at 360 × 800 and
   sign in as a sample rider.
2. Overview: the totals, what's missing and the verdict are visible without
   scrolling. The bottom bar shows four tabs with Overview marked.
3. Tap Rides: the cards appear. Rides that don't count are open, the others are
   closed. Page through and use back twice.
4. Settings: switch the language (you stay on Settings), pick Dark (it applies at
   once and a reload doesn't flash light), and toggle notifications.
5. Widen to 1280 px: the tabs move into the top bar, and the Overview has two
   columns.
6. Open `/me?page=2`, which ends up on `/me/rides?page=2`.

## 3. After release

The maintainer checks SC-001, SC-003 and SC-007 on real phones on the live site
(iPhone with the home indicator, Android, installed app and browser, light and
dark). Issue #20 is closed by the PR (SC-008).

Before deploying, add `public/strava/en/powered-by-strava-white.svg` from Strava's
brand zip and run the asset check in `public/strava/README.md`.
