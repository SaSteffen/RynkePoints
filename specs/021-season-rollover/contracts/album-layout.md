# Contract: album page layout

What `album/layout.ts` computes and `album/render.ts` draws (spec FR-030–FR-038,
FR-050–FR-056; research R13). All measures in millimetres. The Claude Design
mock-up "RynkePoints Saisonalbum" (https://claude.ai/artifact/Cre5jJh2RSpA3RJJe4PuNn) shows them at 96 px per inch
(1 mm ≈ 3.78 px) and decides colours, type and decorations: white paper, the
app's yellow (#fbe122, personal) and team blue (#8cc4f0) for page bands, ink
#1c1b13, Nunito.

## Page

| Measure | Value |
|---------|-------|
| Page | 210 × 297 mm, portrait (`@page { size: 210mm 297mm; margin: 0 }`) |
| Safe area, odd page (right-hand) | left (gutter) 20, right 12, top 12, bottom 12 |
| Safe area, even page (left-hand) | left 12, right (gutter) 20, top 12, bottom 12 |
| Content box | 178 × 273 mm |
| Outside the safe area | white paper, nothing printed (no bleed) |
| Page count | even; a blank page is added at the end when needed |

## Page sequence

1. **Cover and rider** (page 1): title (stand-in "Rynke-Album"), season
   ("Saison 2026/27"), first name, Training and Team Rynke with the coin, team
   events attended.
2. **Team season** (page 2, continued on 3 when long): the team's Training Rynke
   together, then the event table: date, kind, name, riders, ✓ for the rider's
   own attendances. Rows 5 mm, 8 pt; the header row repeats on a continued page.
3. **Sticker pages**: "Meine Abzeichen" then "Team-Abzeichen", each with its
   count ("42 von 87"), categories in gallery order.
4. **Blank page** if the count would be odd.

## Sticker grid

| Measure | Value |
|---------|-------|
| Columns | 3, each 59.3 mm |
| Slot height | 60 mm |
| Placeholder | printed on every slot: the gallery's 44 mm dashed circle |
| Sticker | 44 mm white die-cut circle (2 mm edge) holding the 40 mm picture, on the placeholder |
| Pose | rotation −7° … 7°; offset mostly 0 … 1.5 mm, in one slot in three 2.2 … 3.8 mm, in any direction; y clamped to ±2.5 mm |
| Shadow | `box-shadow` on the circle, 0.8 mm down, 1.3 mm blur, plus a hairline edge; no CSS `filter` (the finish is reworked later) |
| Caption | 8 mm at the slot's foot: name (9 pt, bold) and date earned (9 pt) |
| Page band | 12 mm at the top of the safe area: group name, count, page number on the outer side |
| Category heading | 9 mm; never the last element on a page; repeated with "(Fortsetzung)" when a category continues |

Bounding check: 22 mm radius + 3.8 mm offset + 1.6 mm shadow = 27.4 mm, inside
the slot's half-width of 29.65 mm; vertically 22 + 2.5 + 1.6 = 26.1 mm, which
may touch the caption's top edge by 0.1 mm but never the next slot. A page holds the band, two categories' headings and
four rows (12 + 2 × 9 + 4 × 60 = 270 mm of 273).

## Slot states

| State | Drawn as | Caption |
|-------|----------|---------|
| Earned (`earnedOn <= cutoff`) | the printed placeholder, and over it the sticker: picture (or the group's placeholder picture when it has none yet, e.g. stand-in tour badges), white edge, pose, shadow | name and date |
| Not earned, ladder badge | the printed placeholder only (`BADGE_OUTLINE_PLAIN`'s dashed circle) | name |
| Not earned, surprise badge | the printed placeholder with a large "?" | "?" |

## Pose

```text
h   = fnv1a32("<athleteId>:<badgeId>")
rnd = xorshift32 seeded with h            // one sequence per sticker
miss      = rnd() < 0.35
angle     = rnd() · 2π
distMm    = miss ? 2.2 + rnd() · 1.6 : rnd() · 1.4
dxMm      = cos(angle) · distMm
dyMm      = clamp(sin(angle) · distMm, −2.5, 2.5)
rotateDeg = rnd() · 14 − 7
```

Same inputs give the same sticker (FR-026). The mock-up's slot component
(`Slot.dc.html`) is the reference implementation of this sequence. Fonts: one embedded OFL font, at least
7 pt; lines at least 0.25 pt (FR-055).
