# Quickstart: Rynke Coin Look and Fun Graphics

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## 1. Automated checks

```bash
pnpm lint && pnpm typecheck && pnpm test
```

| Test file | Proves |
|---|---|
| `test/integration/celebrate.test.ts` (new) | Nothing shows on the first visit, and the totals are stored. New Training Rynke, new Team Rynke and both together show once, with the amount. Falling totals show nothing and are stored. The coins are `aria-hidden` (US2, FR-002, FR-007) |
| `test/integration/overview.test.ts` | The hero holds the coin, the greeting and both totals (US1, FR-001) |
| `test/unit/rider-sections.test.ts` | Gauge caption coin and row of ten coins; mini coins on the missing chips and on counting rides; reverse on the qualified verdict; large coin on the empty rides list (US1, US3) |
| `test/integration/team.test.ts`, `landing.test.ts` | Team placeholder coin; landing hero with the coin and tagline (FR-003) |
| `test/integration/sections.test.ts` | Wordmark with the coin |
| `test/unit/html.test.ts`, `test/integration/pwa-pages.test.ts`, `test/unit/manifest.test.ts` | Team Rynkeby theme colours |
| `test/unit/design-tokens.test.ts`, `style.test.ts` | Team Rynkeby values with contrast ≥ 4.5:1. Under reduced motion, `coin-drop` doesn't run (FR-002, FR-005) |
| `test/unit/catalogs.test.ts`, `i18n.test.ts` | New keys exist in de and en |
| `test/integration/db.test.ts`, `schema-minimisation.test.ts`, `me-rynke.test.ts` | `rynke_seen` is removed with the rider and listed in the schema. The rider pages are read-only apart from it (FR-007) |

## 2. Try it locally

`pnpm dev` starts the app with sample riders. To see the celebration, lower a
rider's row in the local `rynke_seen` table, then open the Overview again.

## 3. After release

On the live site, check the pages listed in SC-001 on a phone and a desktop,
in light and dark mode.
