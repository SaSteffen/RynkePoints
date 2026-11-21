# Research: One Team at a Time

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Where the question is asked

**Decision**: in the sign-in callback, for a person the team doesn't hold yet and who isn't on its
guest list, after every check that already turns people away there (blocked, scopes, consent,
club) and before `insertRider`. A person the team already holds is never asked: they are either the
team's rider already, or a double rider from before the feature, of whom none is left (spec
Assumptions).

**Rationale**: every way into a team goes through this callback, so one check covers the rule.
Asking last keeps the gateway out of every sign-in that fails anyway, and asking before storing
anything means a person who stays elsewhere leaves no trace (SC-005).

**Alternatives considered**: a daily sweep that asks the gateway about every rider (riders × teams
requests a day, and it would find doubles only after they counted); asking at every sign-in,
including riders the team holds (no case left that needs it).

## R2. Telling a rider from a guest in the team question

Feature 041's team question answers `connected`, `reconnect` or `none`, for riders and guests alike,
because a withdrawal only cares whether anyone controls the grant. The rule needs to know whether
another team holds the person *as a rider*.

**Decision**: the same request gets one more field. A team answers
`{"held": …, "rider": true|false}`, `rider` true when it holds the person and the row isn't a
guest. The gateway answers `rider: true` when any other team does. The withdrawal reads `held` as
before; the sign-in reads `rider`.

A team's or the gateway's answer without `rider` counts as `false`. Gateway and teams deploy in
parallel jobs (`deploy`, `deploy-gateway`), so for a few minutes either side may run the previous
release; a missing field then lets people in as before the feature, and nothing breaks.

**Rationale**: one question, one round trip, no new secret, and the answer still never says which
team. A second endpoint would duplicate the authentication and the fan-out.

**Alternatives considered**: a separate `rides-here` endpoint (twice the gateway code for one
bit); folding rider-ness into `held` as a fourth value (breaks the withdrawal's ordering of
answers and every caller that compares them).

## R3. The choice, and how a switch gets a token again

When the answer is `rider: true`, the team has just exchanged a token it must not keep (FR-003).
The person then chooses.

**Decision**: the first pass withdraws the token as any refusal does (feature 041 FR-009: another
team holds them, so the row is dropped and nothing is revoked) and redirects to a public page,
`/switch-team`. The page says what switching costs and offers two buttons:

- **Stay with my team**: a link to the start page. Nothing else happens.
- **Switch to this team**: a form posting to `/connect` with the current consent version, the
  `next` the person came with, and `switch=1`. `/connect` sends them to Strava again, with
  `approval_prompt=auto` instead of `force`, and puts the switch flag into the signed OAuth state
  cookie.

Strava skips its approval screen for `auto` when the person has already authorized the app with
these scopes, which they did seconds before, so the second pass is a redirect the person barely
sees. In the second callback the same checks run again, the team question again says `rider: true`,
and the switch flag in the state turns that into a let-go request (R4) instead of the choice.

The consent version in the hidden field is the one the person agreed to on the start page a moment
earlier. `/connect` checks it against the current version as it does for the start page's form.

**Rationale**: no token waits anywhere between the two passes, so "stores nothing yet" holds
literally, and staying or leaving the page needs no clean-up. Everything after the choice reuses
the existing sign-in path, including its checks, which may have changed in between (a block, a
full team).

**Alternatives considered**: keeping the exchanged token in an encrypted short-lived cookie until
the choice (no second Strava round trip, but a token outside the database, its own expiry and
clean-up, and a second code path that stores a rider); asking before the first redirect to Strava
(the team doesn't know who the person is until Strava says so).

## R4. Letting a rider go for a switch

**Decision**: a new pair of endpoints next to the team question, authenticated the same way
([contracts/one-team.md](contracts/one-team.md)):

- the team asks the gateway `POST /teams/<teamId>/let-go` with `{"athleteId": …}`;
- the gateway asks every other team `POST /strava/let-go/<token>`;
- each team deletes the rider's row if it holds them as a rider (never a guest row), with the same
  cascade as every deletion, without a block and without a withdrawal, and answers `200`;
- the gateway answers `200` only when every other team did, otherwise `503`.

The team that lets them go stores and logs nothing about why. Its sessions for the person end with
the row, as after any deletion (`readSession` finds no rider).

**Rationale**: the deletion is one statement, so it can run inside the request and the asking team
gets a real confirmation (FR-006). No withdrawal at the old team, because the new team is about to
hold the grant (FR-005). The trust model is the team question's: a team that knows its own webhook
token is believed (spec Assumptions).

**Alternatives considered**: a queued `delete-rider` at the old team (no confirmation the new team
could wait for); letting the old team withdraw and the new team re-authorize (a revoke ends the
grant at every team, including the new one).

## R5. A kept token for a person the team now holds

The first pass of a switch keeps the exchanged token in `pending_revocations` until it settles
(R3). Usually it settles at once (`connected`: drop). If the other team only held them as
`needs_reconnect`, the row stays to be asked again, and once the switch has gone through, the next
settle would hear `none` from every other team and revoke: ending the grant the new team now uses.

The same can already happen without this feature: a person refused at a team, whose row stays
pending, who later joins that team.

**Decision**: `settleWithdrawal` first checks whether this team holds the person now. If it does,
it drops the row without asking: the team controls the grant and withdraws it when it lets them go.

**Rationale**: one check in the one place every kept token passes through; it fixes both paths.

## R6. Order of a switch and what each failure leaves

**Decision**: let go first, store second.

| Step fails | What the person has | What they see |
|---|---|---|
| Team question unanswered | their old team, unchanged | "Strava is busy" (FR-009) |
| Let-go unanswered or `503` | their old team, unchanged (a team that answered may have let them go; see below) | "Strava is busy" |
| Storing at the new team fails after the let-go | no team; grant kept (nothing revoked) | an error; connecting again lets them in without a choice |

With more than two teams, a `503` can mean one team let them go and another didn't answer. Only
one team holds them as a rider, so a team that didn't answer either didn't hold them or still
does; the first case is harmless, the second leaves them where they were. Trying again settles it.

**Rationale**: storing first would make them a double rider for a moment, with webhook events read
twice; letting go first never does (SC-004).

## R7. What goes

**Decision**: the "you're in another team's club too" notice (`notice/one-team`, its catalog keys in
ten languages), `TeamData.otherClubIds` and its values, the `other` half of `clubMembership` (which
becomes `isClubMember` alone), `team-check`'s rule for it, the dev sample `otherClubMember` and its
fake club, and the steps in `docs/add-a-team.md` that keep the lists. `test/integration/one-team.test.ts`
is rewritten for the new rule.

**Rationale**: FR-010. Nothing else reads the lists.

## R8. Consent and privacy

The team question reads nothing from Strava and keeps nothing: a team learns whether another team
holds the person as a rider, uses it for this sign-in, and forgets it. Constitution Principle I asks
for a new version only for a new scope, a new kind of Strava request or new Strava data, and for a
minor revision only when figures are shown to someone other than the rider. Neither applies.

**Decision**: no new consent version or revision. The privacy notice gets one paragraph in the
section on running the app (ten languages): at connect a team checks whether the person already
rides for another team on RynkePoints, and switching deletes their data at the team they leave.
`PRIVACY_UPDATED` moves to the release date.

## R9. Testing without a second team

The gateway and the other team are stand-ins in tests: the fake Strava already answers the
gateway's `held` for `withGateway` contexts from a map. It gets a `rider` flag per person and a
`let-go` route that records the IDs it was asked for and can be told to fail. Gateway tests cover
the fan-out in `test/gateway/`, as for `held`. `pnpm dev` runs both teams behind the real gateway,
but their sample riders don't overlap, so the choice isn't reachable there; the quickstart says how
to see it in production after the release.

## R10. Two connects at the same moment

Both teams can ask before either has stored the person, and both let them in. Accepted (spec Edge
Cases). `docs/how-it-runs.md` gets the read-only query a maintainer runs on each team's database to
find a person held by two teams, and says how to settle it: ask the person, and let them disconnect
at the team they leave.
