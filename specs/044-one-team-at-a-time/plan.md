# Implementation Plan: One Team at a Time

**Branch**: `044-one-team-at-a-time` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/044-one-team-at-a-time/spec.md`

## Summary

A person rides for one team at a time. A team asks, at sign-in, whether another team holds a new
person as a rider; if so, the person chooses to stay there or switch here, and a switch makes the
other team let them go before this team stores them.

- **The question** (research R1, R2): feature 041's team question through the gateway gets a
  `rider` field (held and not a guest). Asked only for a new, non-guest person, after the club check.
- **The choice** (R3): the first pass withdraws the token as any refusal does and shows
  `/switch-team`. **Switch** goes through `/connect` and Strava again with `approval_prompt=auto`
  and a switch flag in the OAuth state; the second pass lets go and stores.
- **Let-go** (R4): a new gateway endpoint fans out to every other team, which deletes the person's
  rider row (never a guest's) at once, without block or withdrawal, and confirms.
- **Order and failures** (R6): let go first, store second; any unanswered step changes nothing and
  shows "Strava is busy".
- **Kept tokens** (R5): a pending revocation for a person the team now holds is dropped, not
  revoked. Fixes a latent case from feature 041 too.
- **What goes** (R7): the club-based "one team" notice, `otherClubIds` and everything that keeps
  them.
- **Privacy** (R8): one paragraph in the privacy notice; no consent version or revision.

## Technical Context

**Language/Version**: TypeScript on Cloudflare Workers

**Primary Dependencies**: none new

**Storage**: D1, no migration

**Testing**: Vitest in the Workers runtime (`app`, `team:europe`, gateway tests), fake Strava with
the stand-in gateway

**Target Platform**: every team's Worker and the Strava gateway Worker

**Project Type**: server-rendered web app plus the gateway Worker

**Performance Goals**: one gateway round trip per new person's sign-in (none for riders the team
holds or guests); a switch costs a second Strava exchange and club request

**Constraints**: no rider data crosses teams beyond the answer (FR-011); no other team named on a
page (026 FR-023); gateway and teams deploy in parallel, so each side tolerates the other's previous
release (R2, contract's cookie note); no migration

**Scale/Scope**: a few switches a season. About 12 source files (`src/http/auth.ts`, `held.ts`,
`router.ts`, `notice.ts`, a new `switch-team.ts`, `session.ts`, `privacy.ts`, `src/strava/withdraw.ts`,
`client.ts`, `src/db/riders.ts`, `src/teams/*.ts`, `gateway/index.ts`), 10 catalogs × ~6 keys, dev
samples, `scripts/team-check.mjs`, two docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Privacy and consent | Nothing new read from Strava, nothing new stored; the answer says only whether another team holds the person as a rider, never which, and is used for this sign-in only (FR-011). A switch deletes the person's data at the old team completely, like a disconnect. The privacy notice names the check (R8); no consent version or revision is needed | Pass |
| II. Strava API | No new kind of Strava request. A switch repeats an exchange and a club request the person's sign-in already costs. The let-go endpoint is gateway-only, authenticated like `held` | Pass |
| III. Rider content | Nothing written to Strava | Pass |
| IV. Serverless, minimal | No dependency, no table; one endpoint pair beside the existing one, one page | Pass |
| V. Test-first | Each story starts with a failing integration test (quickstart §1); the fake gateway records let-go requests | Pass |
| Language | Choice page and privacy paragraph in all ten catalogs, German first; the old notice's keys go | Pass |

Post-design re-check: unchanged. R5 widens the spec by one rule (a kept token for a person the team
holds is never revoked), which removes a revoke rather than adding a request.

## Project Structure

### Documentation (this feature)

```text
specs/044-one-team-at-a-time/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── one-team.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/http/auth.ts                  # team question at sign-in, switch pass, no one-team notice (R1, R3, R6)
src/http/session.ts               # switch flag in the OAuth state cookie
src/http/switch-team.ts           # GET /switch-team, the choice (new)
src/http/held.ts                  # answer gains rider; POST /strava/let-go (R2, R4)
src/http/router.ts                # routes for /switch-team and /strava/let-go
src/http/notice.ts                # one-team notice removed
src/http/privacy.ts               # one paragraph, PRIVACY_UPDATED (R8)
src/strava/withdraw.ts            # askOtherTeams (held + rider), letGoElsewhere, R5 drop
src/strava/client.ts              # clubMembership without otherClubIds (R7)
src/db/riders.ts                  # riderHold with rider; letGoRider (guest rows untouched)
src/teams/{types,hamburg,europe}.ts  # otherClubIds removed
gateway/index.ts                  # held aggregates rider; POST /teams/<id>/let-go
src/i18n/messages/*.ts            # choice page, privacy paragraph; oneTeam keys removed
dev/fake-strava/*.ts              # otherClubMember sample and fake club removed
scripts/team-check.mjs            # otherClubIds rule removed
docs/how-it-runs.md, docs/add-a-team.md  # rule, switch, finding doubles by hand (R10)
test/support/fake-strava.ts       # stand-in gateway: rider flag, let-go route
test/integration/one-team.test.ts # rewritten for the rule
test/gateway/let-go.test.ts       # new; held.test.ts extended
```

**Structure Decision**: the existing Worker and gateway layout. The cross-team calls live beside
the team question in `src/strava/withdraw.ts`, the one module that already talks to the gateway
about other teams; the choice page is a small public page like the notices.
