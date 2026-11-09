# Data Model: A Second Team

No database change (research R12). The entities below are code and config data.

## TeamData (`src/teams/<id>.ts`)

| Field | Type | Rule |
|---|---|---|
| `id` | string, `[a-z]+` | Equals the deployment's `TEAM_ID`; unique in `TEAMS` |
| `name` | string | Shown in pages, manifest, notifications |
| `shortName` | string | Install name (manifest `short_name`) |
| `defaultLocale` | shipped locale | Visitor states no language (R4) |
| `foreignLocale` | shipped locale | Visitor states only unshipped languages (R4) |
| `rules` | `RynkeRules[]` | Non-empty, ordered by `from` date (R15, FR-019) |
| `eventKinds` | list | Team event kinds the organisers can record |
| `colours` | theme tokens | Light/dark; fun themes listed per team |
| `art` | `ArtMap` | See below |
| `phrases` | `PhraseMode` | See below |
| `badgeNames` | `BadgeNameMode` | See below |
| `otherClubIds` | number[] | Other teams' clubs, for the one-team-at-a-time notice (FR-012) |
| `dev` | `{ host: string; port: number; inspectorPort: number }` | Ports distinct across teams, never 8797/9237; host `localhost` for the founding team, `<id>.localhost` otherwise (fake mode's local-host guard accepts `*.localhost`) |
| `cloudflare` | `{ worker: string; databaseId: string; queueIds: string[] }` | The team's Worker name, D1 database ID and queue IDs, for splitting Cloudflare's figures (FR-040). Worker and database must match the Wrangler block (`team-check`); no queue IDs leaves queue operations unsplit |
| `placeholders` | string[] | Names of fields or vars still copied from another team (FR-053) |

The team's Wrangler block (`wrangler.jsonc` `env.<id>`, every team; research R1)
holds the vars already documented there (`TEAM_ID`, club IDs, dates, feature switches,
controller, contact, push subject), plus `STRAVA_RETURN_VIA` (release 3) and the new
switches `BADGES`, `PHRASES`, `SEASON_ALBUM`, `FUN_THEMES` (`"on"`/`"off"`, default
`"on"`, FR-018), its resources, domain and crons.

**Validation** (`scripts/team-check.mjs`, `test/teams/`): every field present; IDs and
ports unique; every var the Settings type lists present in the team's block; `rules`
sorted; every art path exists; a team with `phrases.kind === "own"` names a shipped
locale; with `--deployable <id>`, `placeholders` must be empty.

## ArtMap

| Field | Type | Rule |
|---|---|---|
| `coin` | path to sprite SVG | Under `public/teams/<id>/` or shared |
| `icons` | manifest icon paths | Required sizes as today |
| `badges` | `Partial<Record<BadgeId, path \| "placeholder">>` | Only the badges whose art is team-specific |
| `teamSpecificBadges` | `BadgeId[]` | Founding team: badges with Hamburg motifs (FR-024) |

A badge in another team's `teamSpecificBadges` must appear in this team's `badges` map,
with its own art or `"placeholder"` (check). Missing entries use the shared default
picture.

## PhraseMode and PhraseSet

```text
PhraseMode = { kind: "own", locale: Locale, set: PhraseSet } | { kind: "common" }
PhraseSet  = { push: string[], onTrack: string[],
               seasonPush: Record<Season, string[]>, seasonOnTrack: Record<Season, string[]> }
```

- Own sets: `src/content/phrases/<team>.<locale>.ts`. Hamburg's is today's list, unchanged.
- Common sets: `src/content/phrases/common.<locale>.ts`, one per shipped locale, with the
  same list lengths in each. About 40 phrases: about 26 push, 6 on track, and at least
  one push and one on-track phrase per season (FR-045).
- Rules for every phrase (existing quote tests, extended): no rider names, ranks or
  comparisons; common phrases also mention no team, place or charity (FR-046).
- Selection: `phraseSet(team, locale)` gives the own set, or else the common set for
  `locale`.

## BadgeNameMode

```text
BadgeNameMode = { kind: "own", locale: Locale, names: Record<BadgeId, string> } | { kind: "common" }
```

Common names are catalog messages `badge.name.<BadgeId>` in every catalog. Hamburg: own,
`de`, today's names.

## Catalog (extends feature 005's)

`MessageValue = string | PluralMessage`, where
`PluralMessage = { other: string } & Partial<Record<"zero"|"one"|"two"|"few"|"many", string>>`.
The key set comes from `de.ts`. A key is plural in every locale iff it is plural in `de`.
Each locale's plural object has exactly its `Intl.PluralRules` categories (R3).

## GatewayConfig (`gateway/wrangler.jsonc`, release 3)

| Name | Kind | Rule |
|---|---|---|
| `TEAMS` | var, JSON list | `[{ "id": "hamburg", "origin": "https://trhh-rynke-coins.link" }, …]`; ids unique, origins `https:` (local: `http://localhost:<port>`) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | secret | Strava subscription check and path token |
| `TEAM_WEBHOOK_TOKEN_<ID>` | secret per team | That team's webhook path token |
| `FORWARD_QUEUE` | queue binding | One message per team per event |

## ForwardMessage (gateway queue)

| Field | Type |
|---|---|
| `team` | team id |
| `event` | Strava webhook body as received (object_type, object_id, aspect_type, owner_id, subscription_id, event_time, updates) |

Not logged. Retries: up to the queue's `max_retries` with backoff. After the last retry,
the gateway logs team ID and event time only, and the team's daily membership/activity
reconciliation is the safety net.

## DevTarget (`scripts/dev.mjs`)

| Field | Source |
|---|---|
| team id | `TEAMS` registry |
| host, port, inspector port | `team.dev` |
| wrangler env | `--env <id>` |
| state dir | `.wrangler/fake-state-<id>` |
| fake samples | `dev/fake-strava/samples.<id>.ts` |

## State transitions

- **Team placeholder lifecycle**: `placeholders` non-empty (local + sandbox only) →
  empty (deployable to production). Only a commit changes it.
- **Strava subscription**: on Hamburg's Worker → on the gateway (manual, FR-011). Both
  endpoints accept events throughout, so the order doesn't lose events.
