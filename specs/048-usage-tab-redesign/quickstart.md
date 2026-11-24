# Quickstart: Usage Tab Redesign

How to see that the feature works. Tests come first per story (constitution V).

## Tests

```bash
pnpm test test/unit/usage-figures.test.ts     # early level per group, exact edges
pnpm test test/unit/usage-alerts.test.ts      # Hinweis fires once per period; open rows clear
pnpm test test/unit/usage-attention.test.ts   # order, counts, day window, hints not counted
pnpm test test/integration/admin-usage        # page: list, calm, rows, deep links, switch
pnpm test test/integration/admin-usage-badge  # Admin tab and Nutzung number
pnpm test test/unit/migrations.test.ts        # migration list
```

Expected:

- A figure at exactly 25 % is Hinweis, 24.99 % is fine; 80 % Warnung, 95 %
  Kritisch.
- A daily figure crossing 25 % sends one notification worded "Hinweis: …"; a
  second check that day sends none; crossing 80 % later sends one more.
- Storage falling below 25 % clears its open Hinweis, so the next rise notifies.
- A 15-minute figure at 30 % is marked on the page and sends nothing.
- With one Kritisch, one Warnung, one Hinweis, a silent other team and no
  device: the list has five rows in that order, the head says "1 kritisch · 1
  Warnung · 1 Hinweis", and the Admin tab shows 3.
- A routing day marked two days ago is in its opened row but not in the list
  and not counted.

## In fake mode

```bash
pnpm dev:hamburg
```

Sign in as Alex Admin at http://localhost:8789/_dev/ and open Admin › Nutzung.

1. Compare the page with the design draft's boards at phone (390) and desktop
   (1280) width.
2. Tap each row of "Das braucht deinen Blick": the page jumps to its row and
   opens it.
3. At phone width with the 15-minute figures at 0 %, their rows are hidden and
   the note says so; at desktop width they show.
4. Open "Strava-Aufrufe", pick a day: the breakdown opens as before.
5. Open "Alle Tage" on a figure: the row stays open with the list.
6. Turn the alerts switch off and on: the row's text and `aria-checked` follow.
7. On any other page, the Admin tab carries the same number as the list's head.

The design-canvas skill (`.claude/skills/design-canvas`) can shoot both widths
for the comparison.
