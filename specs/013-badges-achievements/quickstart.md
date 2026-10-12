# Quickstart: Badges and Achievements

Part A validates the art pipeline, part B the app, part C the categories added
on 2026-10-12 (see [plan.md](plan.md)).

# Part A: art pipeline

Details of files and commands are in
[contracts/badge-assets.md](contracts/badge-assets.md).

## Prerequisites

- `pnpm install`; Google Chrome; a Google account with Gemini image generation.
- ImageMagick and potrace on the `PATH` (`pacman -S imagemagick potrace`).

## 1. Pure parts

```bash
pnpm test badge
```

Expected: `badge-prompts` and `badge-frame` tests pass (validation, prompt
assembly, coin Rynke match, composition).

## 2. Frames and placeholders

```bash
pnpm badge-build
```

Expected: `public/badges/placeholder-*.svg` written;
with no originals, `src/badges/pictures.ts` lists nothing. Open both
placeholders next to `art/badges/reference/`: same design (petals, ring, three
stars), Rynke centred in the window, personal black ring, team light blue ring. Run it again: `git status` shows no
change.

## 3. One picture end to end

```bash
pnpm badge-art distance-100
```

Expected: Chrome opens; on the first run, sign in to Google and the script
continues by itself. A new Gemini chat gets the personal reference and the
prompt; the image lands in `art/badges/originals/distance-100.png`. Then:

```bash
pnpm badge-build
```

Expected: the original is snapped in place (a few hundred KB at most),
`public/badges/distance-100.svg` exists (under 100 KB) and
`src/badges/pictures.ts` lists `distance-100`. Open the SVG at 64, 128 and 280 px
in a browser: picture inside the window, nothing cut off that matters, no white
halo, outlines crisp; it looks the same on a light and a dark background.

## 4. Resume and limits

- Interrupt `pnpm badge-art` (Ctrl+C) during a run and start it again: badges
  already saved are skipped.
- `pnpm badge-art --print team-running-500`: prints the prompt and the team
  reference path, opens no browser.
- `pnpm badge-art nope`: exits with code 2.
- Pacing: with three badges to make, `pnpm badge-art --max 2` makes two, rests
  between them (watch the "resting" line, 90 to 180 s), and reports one left.

## 5. A retake

Delete `art/badges/originals/distance-100.png` (or `pnpm badge-art --force
distance-100`), generate again, `pnpm badge-build distance-100`: only that
badge's SVG changes, the list stays the same. `pnpm badge-build nope` exits with
code 2.

# Part B: the app

Details in [contracts/abzeichen-section.md](contracts/abzeichen-section.md) and
[contracts/badge-messages.md](contracts/badge-messages.md).

## 6. Tests

```bash
pnpm test badge && pnpm test runs
```

Expected: catalog (69 badges, same as `art/badges/badges.json`), personal and
team evaluation, view model, intake of runs, evaluation batches, the section,
reveals and the notification text pass.

## 7. The section on the fake Strava

```bash
pnpm dev
```

Sign in as each sample rider (R21) at 360 px and at desktop width, in light and
dark mode:

- a new rider: the waiting state, no Abzeichen section;
- a rider without badges: the empty state and every category under "Noch kein
  Abzeichen";
- a rider with badges: cards newest first with the milestone on the ribbon,
  "Noch …" under each, team bars blue, "Alle meine Abzeichen (n)" closed; open
  it and tap a badge: the large view with name, what it was for and the date;
  with a mouse, hover opens it too;
- a run rider: running badges, and the same Rynke, ride list and Team page as
  without the runs (SC-004);
- view the page source: no id, name or picture of a badge the rider hasn't
  earned (SC-003).

## 8. Earning, reveal, notification

Add a run that crosses a threshold to a sample rider through the fake Strava's
webhook: the next Overview visit shows the reveal once, a reload doesn't
(SC-001); with notifications on, the notification names the badge. Send the
same webhook again: nothing changes (SC-002). Delete the run: the badge is taken
back, without a notification.

## 9. Existing riders

On a copy of the local database from before this release, apply
`0013_badges.sql` and run the daily cron (`pnpm daily:run` in fake mode): riders
are re-read once for their runs (figures version 4) and re-evaluated once for
the badge catalog, without notifications.

# Part C: more categories (2026-10-12)

## 10. Pictures for the new badges

```bash
pnpm badge-art --print winter-december-10   # read one prompt first
pnpm badge-art                              # the 32 badges without an original
pnpm badge-build
```

Expected: 32 new originals in `art/badges/originals/`, their SVGs in
`public/badges/`, and `src/badges/pictures.ts` listing them. Check each
picture as in part A ("Checking a picture"); swims show the yellow swim cap
with three stripes instead of the helmet. Until then the new badges show the
placeholder, and nothing else changes.

## 11. Tests

```bash
pnpm test badge && pnpm test swims && pnpm test runs
```

Expected: catalog (21 categories, 101 badges, same as `art/badges/badges.json`),
evaluation of ride length, virtual rides, swims and the winter months, the view
of a winter month that is over, swim intake and the section pass.

## 12. The new categories on the fake Strava

```bash
pnpm dev
```

On the sample riders (research R31), at 360 px and desktop, light and dark:

- the ride-length card counts the longest counting ride, also a virtual one;
  every badge up to 300 km for the rider with the 312 km ride;
- virtual rides add up only virtual and trainer rides, and Distance still
  includes them;
- two outdoor rides on one January day count as one day; a trainer ride on a
  December day doesn't count for December;
- swims: pool and open water count, the manual swim doesn't; the Rynke, ride
  list, Team page and every team category are the same as without the swims
  (SC-004);
- set the clock past February (or a sample rider's season that is over): the
  winter cards show no bar, the earned ones keep their badge, the others their
  outline.

## 13. Existing riders

On a copy of the local database from before this release, apply
`0015_swims.sql` and run the daily cron (`pnpm daily:run` in fake mode): riders
are re-read once for their swims (figures version 5) and re-evaluated once for
the new categories (catalog version 2), without notifications; their first
visit shows one reveal of every new badge.

