# Quickstart: Checking Feature 022

Automated checks cover behaviour; the look is checked by the owner on the live
site against the canvas (spec, Assumptions; SC-006).

## Automated

```bash
pnpm lint && pnpm typecheck
pnpm test                       # tokens and contrast for all twelve themes,
                                # head script, shell header, settings, catalogs
pnpm exec playwright test e2e/themes.e2e.ts   # menu, persistence, carry-over, shows
```

What the tests prove:

| Check | Where |
|-------|-------|
| Every theme's text pairs ≥ 4.5 : 1, outlines/icons ≥ 3 : 1, contrast themes ≥ 7 : 1 (FR-018, SC-003) | `test/unit/design-tokens.test.ts` |
| Every control rule uses `--rp-type-control`, `--rp-outline-width`, no literal colour; selected = primary-container (FR-001–FR-006) | `test/unit/style.test.ts` |
| Head script: theme applied, `rp-scheme` carried over, unknown id ignored, `theme-color` set, show flag handled (FR-014, FR-015, FR-019) | `test/unit/html.test.ts` |
| Palette button before the refresh link on every section; menu with Automatisch, 12 themes in 3 groups, Glitzer on the fun two, the note (FR-010, FR-011) | `test/integration/` shell tests |
| No colour-scheme choice on Settings (FR-016) | settings integration test |
| Every new message in de and en; removed ids gone (FR-021) | catalog tests |
| Pick Wald → applied without reload, survives reload and sign-out; Escape and outside tap close and return focus (US2) | e2e |
| Old `rp-scheme=dark` → Rynke Nacht on first load (US2 scenario 4) | e2e |
| Fun decorations only under Konfetti and Disco, never catching a tap, still under reduced motion; ink on every rainbow band ≥ 4.5 : 1; badge, sparkles and bursts `aria-hidden` (US3) | `test/unit/style.test.ts`, `design-tokens.test.ts`, sections test |
| Konfetti and Disco: tab → overlay, page changes at the peak (timed by the navigation request), the arriving page plays the rest and lets go; tap skips; reload, current tab, back and non-fun themes play nothing; reduced motion → short fade (US4) | e2e |
| The page names only built show pictures (FR-049); `shows.json` holds exactly the unicorn and the disco | sections test, `test/unit/quote-prompts.test.ts` |

## By hand (`pnpm dev`, http://localhost:8789)

1. Sign in as a sample rider. Open the palette button on Team, Du, Badges,
   Settings at 390 px and at desktop width; compare with the Main board.
2. Choose each of the twelve themes and walk every page; compare with the
   Gallery and Fun boards. Check the Strava attribution variant on a dark
   theme.
3. Konfetti and Disco: switch tabs; compare with the Transitions board (rain,
   coin, unicorn path, ball, beams, spots, Rynke dancing). Tap during a show.
   Turn on reduced motion in the OS and switch again.
4. Settings: no Darstellung group.
5. Repeat the control audit on every page in Rynke Tag and Rynke Nacht:
   one look per control type and state (SC-001).

## Where the build departs from the contracts

- **"Neues Abzeichen" chip** (fun-decorations.md): the app has no such chip;
  the rainbow pill look goes on the new-badge notice (`.badges-reveal`). The
  single gauge fill has no key swatch, so only the fill is a rainbow.
- **Qualified card**: the bursts fall on the organiser overview's qualified
  list (`.qualified`), which is a hero card here, not primary-container.
- **Sparkles and bursts** are `aria-hidden` spans (`src/http/fun.ts`) placed
  last in each hero card; the palette badge is an empty
  `span.theme-badge`, its look all CSS.
- **Decoration and show colours** are tokens (`--rp-fun-*`, `--rp-show-*`),
  the same in both schemes, so no rule outside the token blocks holds a
  literal colour (011 FR-031).
- **Arriving half** (page-switch-show.md): `data-show` becomes `playing`
  instead of being removed when the overlay mounts, so the page's
  celebrations stay paused until the show ends. The overlay is advanced to
  the switch with the Web Animations API (`getAnimations`). The peak cover
  hides itself after 2 s should `app.js` never come.
- **Flag age**: `FLAG_MAX_AGE_MS` lives with the head script
  (`SHOW_FLAG_MAX_AGE_MS` in `src/http/html.ts`), its only reader; the head
  script reads the clock from `performance` (the catalog holds "Date").
- **Show pictures**: the theme menu panel carries `data-show-coin` as well as
  `data-show-unicorn` / `data-show-disco` for the built ones.
