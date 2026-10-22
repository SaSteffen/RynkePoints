# Contract: One Set of Controls (Phase 1)

Source: canvas board "Ein Satz Bedienelemente" (Controls), read 2026-10-22: the
audit ("Heute") and the proposal, shown in Rynke Tag, Rynke Nacht, Ostsee and
Kontrast dunkel. Phase 1 changes no colour values, only which roles controls
use (spec, Assumptions).

## New tokens

| Token | Value | Use |
|-------|-------|-----|
| `--rp-type-control` | `600 14px/20px var(--md-ref-typeface)` | every button, choice, filter, summary |
| `--rp-type-status` | `600 12px/16px var(--md-ref-typeface)` | status chips |
| `--rp-outline-width` | `1px` (contrast themes `2px`) | every control outline |
| `--rp-primary-text` | see themes.md | text of outlined/text buttons, summaries, links |

## The set

| Type | Classes (today's, kept) | Look |
|------|-------------------------|------|
| Filled | `.button` | min-height 44 px, padding 0 20 px, pill, no border, `primary` / `on-primary`, `--rp-type-control`. One per card (FR-005). |
| Outlined | `.button-outlined`, bare `button` | 44 px, padding 0 20 px, pill, `--rp-outline-width` solid `outline`, transparent, text `--rp-primary-text` |
| Text | `.button-text` | 44 px, padding 0 12 px, pill, no border, text `--rp-primary-text`; contrast themes underlined |
| Danger | `.danger` | as outlined, border and text `error` |
| Icon | `.icon-button` | 44 × 44 px round, icon 22–24 px, `on-surface-variant`; open/active: `primary-container` / `on-primary-container` |
| Segmented | `.segmented`, `.segmented-group label` | 44 px, padding 0 16 px, joined pill (first/last rounded), `--rp-outline-width` `outline`; selected (`aria-current`, `:checked`, `aria-pressed=true`): `primary-container` / `on-primary-container` |
| Filter chip | `.chip[aria-pressed]`, `.badges-filter label` | 36 px high inside a 44 px tap area, padding 0 12 px, radius 8 px, `--rp-outline-width` `outline`, text `on-surface`; selected: `primary-container` / `on-primary-container`, border `primary-container` (contrast themes: border `outline`) |
| Status chip | `.chip`, `.chip-team`, `.chip-alert`, `.status-chip` | 28 px, padding 0 10 px, radius 8 px, `--rp-type-status`, its role's container colours; contrast themes: 2 px `currentColor` border; display only |
| Disclosure | `summary`, `.more>summary`, `.ride-why>summary` | 44 px, `--rp-type-control`, `--rp-primary-text`, chevron 14 px after the text, rotates when open |
| Switch | `[role=switch]` | unchanged (011) apart from the outline width |

Hover, press (`scale(.96)`) and busy states stay as today for all types.

## Audit findings and their fix (FR-007)

| Today (canvas "Heute") | Where | Fix |
|------------------------|-------|-----|
| Selected filter black on light / beige on dark (`on-surface`) | Team filter (`.segmented[aria-current]` in the team switch), Badges filter (`.badges-filter label:has(:checked)`) | `primary-container` / `on-primary-container` |
| Request yes/no buttons 40 px, 2 px border, weight 700, 13 px | Orga requests, "Ich war auch dabei" (019) | Filled / outlined at 44 px, 1 px, `--rp-type-control`; the round × becomes an icon button |
| Two filled styles in dark (yellow vs. beige) | "Anlegen" vs. "Eintragen" | Both `.button` |
| Disclosure summaries in 13, 14 and 16 px, grey / black / primary | Orga ("Woher die Rynke kommen"), Du ("Alle Details"), Team ("Zahlen als Tabelle"), Fahrten ("Warum?") | All "Disclosure" |
| Chips at 24, 32 and 44 px, weights 500–800 | Termine, Fahrten, Du | Status chips 28 px; the two chips that act as filters become filter chips |
| Segmented groups in four shapes (joined pill, pill in a track, 8 px separate, 8 px separate black) | Settings language, Team switch, Du range, Badges filter | Joined pill for 2–4 options of one choice; 8 px filter chips for filters |

The implementer re-measures every page in Rynke Tag and Rynke Nacht after the
change (SC-001); the measuring script used for the audit is kept out of the
repo (manual tool, no tests).
