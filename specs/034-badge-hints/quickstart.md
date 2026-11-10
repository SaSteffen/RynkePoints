# Quickstart: Badge Hints from the Monkey

## Automated

```bash
pnpm test test/unit/badge-hints.test.ts test/unit/hint-lines.test.ts test/integration/badges-section.test.ts test/teams
pnpm test:e2e e2e/badge-hints.e2e.ts --project chromium
```

Covers: hint windows and feasibility (contracts/hint-candidates.md), lines and veiling
(contracts/hint-lines.md), page markup and the browser pick (contracts/badges-page.md).

## By hand in fake mode

1. `pnpm dev`, open Hamburg (http://localhost:8791 → Hamburg) as Bea Badges.
2. On `/_dev/`, pretend the day, open `/me/badges`, clear `rp-badge-hint` in the browser's storage
   before each first visit:

| Day | Expected |
| --- | --- |
| 2026-11-20 | a hint on the first visit; one of the in-reach hints (Distance, November, …) |
| same day, ten more visits | a hint on about half, never the same twice in a row |
| 2026-12-20 | Christmas Eve or Christmas nudge among the hints over a few visits |
| 2026-12-27 | no Christmas Eve nudge |

3. Tap the hint: the page scrolls to the card, which gets an outline for a moment. With "Alle"
   picked first, the filter switches to "Neueste".
4. Leave the tab in the background for over a minute and come back: the page refreshes in place,
   the hint stays the same.
5. Switch the language to English and to French: the hint stays German (Hamburg), as the badge
   names do. On Europe, German as the rider's language: the hint stays English.
6. Phone width (360 px), light and dark, two themes: no horizontal scroll, readable bubble.
7. Europe (http://europe.localhost:8790): hints work, no Hamburg names or places.
8. Reset the clock on `/_dev/`.
