# Data Model: Mobile App Shell with Sections and a Material Look

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

There is no D1 change, migration or new queue message. This feature moves and
restyles what features 004, 005 and 010 already read. No new Strava request or
newly shown data means no new consent version (spec Assumptions,
constitution Principle I).

## Section (code only)

A fixed list in `src/http/shell.ts`. The order is the navigation order (FR-002);
Orga (feature 016) sits before Settings for organisers. Team comes first and is
where the app sends a signed-in rider (issue #73).

| id | Path | Label key | Icon | Reads |
|---|---|---|---|---|
| `team` | `/team` | `nav.team` | people | the team (feature 016) |
| `you` | `/me` | `nav.you` | coin (feature 012) | rider view, page 1 |
| `rides` | `/me/rides` | `nav.rides` | bike | rider view, page `N` |
| `settings` | `/me/settings` | `nav.settings` | sliders | current consent record |

The current section comes from the route, never from the client.

## Scheme preference (device only)

| Where | Key | Values | Lifetime |
|---|---|---|---|
| `localStorage` of the device | `rp-scheme` | `light`, `dark`; absent means System | until the rider changes it or clears site data; survives signing out (FR-032a) |

It is never sent to the server and isn't rider data. Feature 010 already keeps
`rp-install-dismissed` in the same place.

## OAuth state cookie (changed value)

Feature 004's signed cookie value gains the path to return to:

| Field | Before | After |
|---|---|---|
| value | `<state>:<consentVersion>` | `<state>:<consentVersion>:<next>` |
| `next` | — | one of `safeNext()`'s paths (contains no `:`); old two-part values read as `/me` |

The lifetime, signing and clearing are unchanged.

## Design tokens

The site-wide colours (light and dark), type, spacing, shapes and motion are in
[contracts/design-tokens.md](contracts/design-tokens.md). They are a constant in
`src/http/style.ts` and are never stored.
