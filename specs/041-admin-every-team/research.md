# Research: Administrators on Every Team's Site

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Two teams holding tokens for the same person (FR-010)

**What Strava documents** (developers.strava.com/docs/authentication, read 2026-11-18):

- On refresh, "the older refresh token is invalidated immediately" once a new one is returned; the
  refresh token returned "may or may not be the same" as the one sent.
- Access tokens last six hours; after a refresh both the old and the new access token work until
  they expire.
- `POST /oauth/revoke` takes one token, and revoking a refresh token also revokes its access tokens.
  `POST /oauth/deauthorize` invalidates all of the app's tokens for the athlete. The docs don't say
  whether `revoke` also reaches tokens from another authorization.
- The docs say nothing about what a second code exchange (a second authorization of the same app by
  the same athlete) does to the tokens of the first.

So whether a guest site can hold its own token without breaking the home team's can't be settled
from the docs, and the fake Strava can't show it. Feature 026's edge case assumed the worst.

**Decision**: a maintainer verifies it once with their own Strava account before the reading part
of the feature is built ([quickstart.md](quickstart.md) §1). The design branches on the result:

| Outcome | What it means | What the feature does |
|---|---|---|
| **A. Independent** | Each authorization has its own token chain; refreshing or revoking one leaves the other working | Everything in the spec: the guest site reads the guest's activities (FR-005) |
| **B. Shared, refresh breaks the other** | A second exchange leaves the first chain working, but a refresh at one team invalidates the other team's refresh token | FR-010's fallback: the guest site stores no credentials, starts no import and ignores the guest's webhook events; the guest's own pages stay empty (R10) |
| **C. Exchange breaks the other** | The second code exchange already invalidates the home team's token | Signing in through Strava can't keep the home team working; stop and take the spec back to the user |

Revoking is avoided in every outcome (R5), so the verification needn't test whether a revoke
reaches the other chain.

**Observed in production, 2026-11-18**: whether a revoke reaches the other chain is settled, and the
answer is yes. A Hamburg rider who wasn't in Europe's club signed in on Europe's site. Europe, still
running the code from before this feature, refused the sign-in and revoked the token it had just
exchanged. That ended the app's whole grant for the person. Strava then sent the deauthorization
event, which the gateway passes to every team, and Hamburg deleted the rider at once (reason
`deauthorized`). A revoke by one team therefore ends the person's connection at every team. The
test in §1 no longer asks this question.

**Observed later the same day**: `start` gave outcome A or B, not C. Two code exchanges left the
first chain working.

**Outcome: A** (`finish`, 2026-11-18). After the wait, refreshing the first chain renewed it and
the second chain still refreshed: each team's token keeps working while the other renews its own.
Guests' rides are read as planned; R10 isn't built.

**Rationale**: reading the guest's rides is what makes their pages look like a rider's (US2), but
it's worth nothing if it breaks the home connection (US3). One manual test settles it; the rest of
the feature (sign-in, roles, exclusion, no revoke) is the same in outcomes A and B.

**Alternatives considered**: building B always (no reading) gives up US2's own-pages part when it
may well be unnecessary. Asking Strava support takes longer than the test and may not answer.

## R2. Where the guest list and the guest mark live

**Decision**: two pieces in each team's own D1 (migration `0030_guests.sql`):

- `guests (athlete_id INTEGER PRIMARY KEY)`: the guest list. Only the maintainer writes it, by hand,
  like `riders.organiser` and `riders.administrator`.
- `riders.guest INTEGER NOT NULL DEFAULT 0 CHECK (guest IN (0, 1))`: the app sets it at sign-in from
  the list (R4). It marks the row as a guest's for as long as the row exists, also after the
  maintainer took the ID off the list and until the daily run deletes the row.

**Rationale**: the list alone can't do it. A rider row whose ID left the list would turn into an
ordinary rider: counted in the team's figures (against FR-007) and later deleted by the club check
with a revoke (against FR-009). The mark alone can't do it either: the maintainer must be able to
name someone before they sign in, and taking them off must end access at once (FR-004).

**Alternatives considered**: a `guest` column only, set by hand after the person signs in: the
sign-in itself would fail the club check. A list of home teams per guest: needs data to cross teams
(FR-012).

## R3. One place that keeps guests out of every team count (FR-007)

Every query that lists, counts or sums riders for someone other than the rider already goes
through the consent filters in `src/db/consents.ts` (004 FR-021): `sharedRiderIdsSince`,
`sharedRiderExists` and `SHARED_RIDER_IDS`, and through `LISTED_RIDER_IDS` / `listedRiderFilter`
built on them in `src/db/organiser.ts`. Their users: `team.ts` (team page, Team Rynke, ride
figures, team badge sums, surprises), `organiser-graphs.ts`, `rider-summaries.ts`,
`participation.ts`, `badges.ts` (team badge audience), `team-events.ts` and `corrections.ts`
(change records), `riders.ts` (admin rider overview). The season album loads through the same
functions.

**Decision**: the two consent helpers also leave guest rows out: a guest's data is never shared
with the team, whatever consent they gave. `sharedRiderExists(alias, v)` gains
`AND ${alias}.guest = 0`; `sharedRiderIdsSince(v)` gains
`AND athlete_id NOT IN (SELECT athlete_id FROM riders WHERE guest = 1)`. Everything built on them
follows.

Three counts don't go through them and get the same condition by hand:

- `connectedCountStatement` (admin usage view and the teams' shared capacity figure): the guest
  already counts at home; Strava counts athletes per app, so counting them again would be wrong too.
- `readRiderOverview`'s "others" count: it counts riders *outside* the shared filter, which would now
  include guests (R7).
- `listAlertRecipients` / `currentAlertStatement` read `administrator = 1` in SQL and need
  `OR guest = 1` (R4), the opposite direction: a guest gets the alerts.

Reads that aren't team counts stay as they are: the rider's own pages (`athlete_id = ?`), the
maintenance reads (pre-season clean-up, Tour de Paris renumbering, re-evaluation sweep) and the
work queue.

**Rationale**: one condition in the helper the spec's invariant already rests on is easier to keep
right than ten filters in ten files. The invariant test (R9) catches any count that doesn't use the
helpers.

**Alternatives considered**: a filter per file (what the summary of the spec estimated): more places
to forget, and the next team count would have to know about guests. A SQL view `team_riders`: every
existing query would have to be rewritten to use it, for the same effect.

## R4. Roles: a guest is an organiser and an administrator (FR-004)

**Decision**:

- `riderStatement` also selects `EXISTS (SELECT 1 FROM guests g WHERE g.athlete_id = r.athlete_id)
  AS on_guest_list`. `toRider` gains `guest` (the mark) and sets `organiser` and `administrator` to
  the stored flag **or** `guest`. Every page and check that reads `rider.organiser` /
  `rider.administrator` (16 places) then treats a guest as both, without a change.
- `readViewer` returns `visitor` for a row with `guest = 1` that is no longer on the list (FR-004:
  access ends with the next request). Nothing is deleted on that request; the daily run does it (R6).
- The stored `organiser` and `administrator` columns stay the maintainer's; the app never writes
  them for a guest.
- Alerts: `listAlertRecipients` and `currentAlertStatement` read `(administrator = 1 OR guest = 1)`,
  so a guest gets the team's usage alerts and has the same switch (FR-004 "alerts").

**Rationale**: roles are already read afresh with the rider row on every request (004 FR-003); this
keeps them there. Taking the mark from the row and the list membership from the same query costs no
extra round trip.

## R5. Never revoking where it could end another team's connection (FR-009)

**Superseded by R14.** Never revoking left grants that no team controls. R14 revokes unless another
team holds the person. The text below is the first decision, kept for the record.

Revocations today: `handleCallback` revokes the just-exchanged token on every refusal (blocked,
missing scopes, consent missing, not a member, inconclusive); `revokeStoredToken` revokes the stored
token on disconnect (`me.ts`), admin removal (`admin/remove.ts`) and `delete-rider` messages with
`revoke: true` (club check, expired reconnect).

**Decision**:

- `revokeStoredToken` revokes nothing for a guest row and answers `ok`. All three callers are covered
  in one place: a guest's disconnect, removal, expiry or deletion deletes their data at this team and
  leaves the grant.
- `handleCallback` no longer revokes on any refusal at sign-in: the exchanged token is simply never
  stored. FR-009 requires this for "not a member"; the same hazard applies to every other refusal there,
  because the team can't know at that point whether the person is connected to another team. The
  access token expires within six hours; nothing of the person is kept.
- Disconnecting at the home team still revokes (they are no guest there), as the spec's edge case
  expects.

**Rationale**: the outcome of R1 doesn't matter for this: not revoking is safe in all three. A
revoke is known to end the grant at every team (R1, observed in production), so this is required,
not just careful. Revoking stays where it's right: a team's own rider who disconnects, is removed,
leaves the club or doesn't reconnect. That person's grant ends everywhere, and a team where they
are a guest deletes them on the deauthorization event. Someone a team refuses can withdraw access
only themselves, in their Strava settings.

**Alternatives considered**: keeping the revoke for the refusals FR-009 doesn't name (blocked,
missing scopes, consent): the same Hamburg rider who tries Europe's site and unticks a scope, or is
blocked there, would lose Hamburg. Revoking on refusal was cleanliness only; the stored data is what
the constitution requires deleted, and it's never stored.

## R6. The daily run and the club check (FR-004, FR-006)

**Decision**:

- `fanOutMembershipChecks` lists connected riders with `guest = 0` only (new `listClubRiderIds`);
  `listConnectedRiderIds` stays as it is for its other caller (catch-up).
- At sign-in a person on the guest list skips the club request (FR-003); one fewer Strava request.
- A new daily step deletes guest rows whose ID is no longer on the list: a `delete-rider` message
  with the new reason `guest-removed` and `revoke: false`.
- Expired `needs_reconnect` guests are deleted as before; R5 makes it revoke nothing.

## R7. The admin view's riders (FR-008)

**Decision**: `readRiderOverview` returns a third part, `guests` (the same fields, `guest = 1`),
shown in its own group below the team's riders, each marked as a guest. The "others" count leaves
guests out. `listedRiderName` (the removal page's check) also accepts a guest row, so an
administrator can remove a guest like any rider (edge case; block plus deletion, no revoke by R5).
No other list on the site shows guests: they are out of the shared filter (R3).

## R8. Sign-in for a guest (FR-003, FR-006, FR-008)

**Decision**: in `handleCallback`, after the block check and the scope and consent checks, read the
guest list. On the list:

- no club request; the rider is inserted, or updated on reconnect, with `guest = 1`;
- no "one team" notice;
- otherwise the same flow (consent record, credentials, import), subject to R1's outcome.

Not on the list: today's flow, and the row's `guest` is set to 0 if it was 1 (a former guest who is
now in the club becomes a rider of the team; one who isn't is turned away as not a member).

## R9. Proving the invariant (FR-007, SC-002)

**Decision**: one integration test renders, as a non-guest organiser and administrator, every
team-facing page (Team views, Orga pages, Admin pages except the riders list, the season album's
data) and every team count function, first with a guest who has rides, Rynke, badges, event
reports and a consent, then after deleting the guest's rider row. Outputs must be byte-identical at
the same `ctx.now()`. A second test checks the riders list shows the guest only in the guest group.
A unit test checks `sharedRiderIdsSince` / `sharedRiderExists` leave a guest out.

**Rationale**: comparing whole outputs catches a count that bypasses the helpers without having to
list every count in the test.

## R10. Fallback if Strava allows only one working token (R1 outcome B)

**Decision**, built only in outcome B: for a guest row, `handleCallback` stores no credentials and
sends no `import-page`; the consumer acknowledges and drops any work for a guest without credentials;
the re-check leaves guests out (`ELIGIBLE` gains `guest = 0`). Their own pages show the existing
"no rides yet" states.

## R11. Change records by a guest

Organiser changes keep `changed_by` (feature 014). A change record shows the organiser's name only if
they are in the shared filter, so a guest's change shows as "former organiser". **Decision**: keep
it. It names no team (FR-012, 026 FR-023), and guests acting on a live team are rare.

## R12. Consent (FR-011)

Principle I: a major version for a new scope, request or data read; a minor revision for showing
existing figures to someone new. Guests read nothing new from Strava, and the riders' consent already
names administrators ("run the app for the team") and organisers by role. A guest's own data is shown
to nobody but themselves (R3). No version or revision changes. The privacy text needs no change; a
guest agrees to the team's current consent like anyone.

## R13. Fake mode

**Decision**: each team's sample set gets one sample guest (not in the club, on the guest list, with
rides, a fixed synthetic ID). The seed puts the ID on the list and connects them through the app like
the other samples, so `pnpm dev` and the sandboxes show the feature. Any test that reads the sample
set's team figures must stay unchanged; only the admin riders list gains the guest group.

## R14. Withdrawing a grant unless another team holds the person (FR-009, FR-012)

A revoke ends the whole grant, at every team (R1). Never revoking (R5) leaves grants nobody
controls: anyone turned away keeps RynkePoints in their Strava settings, with a token nobody holds.

**Decision**: every withdrawal goes one way ([contracts/withdrawal.md](contracts/withdrawal.md)):

1. The team puts the refresh token, still encrypted, into `pending_revocations` (one row per
   person; a newer token replaces an older one, since any revoke ends the whole grant). For a
   stored rider it copies `strava_credentials.refresh_token_enc` before deleting the rider. At a
   refusal it encrypts the token it just exchanged. Then it settles the row at once, in the
   background of the request or message.
2. To settle, it asks the gateway whether another team holds the person. The gateway asks every
   other team in `TEAMS` and answers with the strongest of their answers:
   - `connected`: another team holds them with a working connection. Drop the row; that team
     withdraws the grant when it lets them go.
   - `reconnect`: another team holds them, but only as `needs_reconnect`. Its token may be dead,
     so keep the row and ask again later.
   - `none`: revoke the token, then drop the row.
   - No answer from the gateway or any team: keep the row.
3. The daily run settles every row left.

Who holds whom is read from `riders`: a row with `status = 'connected'` answers `connected`; only
`needs_reconnect` answers `reconnect`. Guests are rows like any other. A team without the gateway
(`STRAVA_RETURN_VIA` empty: tests, `pnpm dev`, sandboxes, a single team) has nobody to ask and
answers `none` itself.

Authentication needs no new secret. The gateway already holds each team's
`STRAVA_WEBHOOK_VERIFY_TOKEN` as `TEAM_WEBHOOK_TOKEN_<ID>`. A team asks with its own token, the
gateway checks it against the team it names, and asks each other team with that team's token, in
the path as the forward does. The gateway logs only statuses, never an ID.

A team reaches the gateway at `STRAVA_RETURN_VIA`, the gateway's Custom Domain, with a plain
`fetch()`. Checked against Cloudflare's docs (Workers › Custom Domains, "Worker to Worker
communication", 2026-11-18): a fetch from one Worker to another Worker on a Custom Domain in the
same zone succeeds without a service binding; only routes and `workers.dev` need one. That covers
Hamburg, whose domain is the gateway's zone. Europe's domain is another zone, so its fetch is an
ordinary subrequest under the gateway zone's security settings. Europe's usage exchange already
makes that kind of request to Hamburg, and Strava's webhook POSTs already reach the gateway.
WAF custom rules don't apply to same-zone subrequests, so the gateway checks the token itself.

This replaces the guest exception in `revokeStoredToken` and the "no revoke on refusal" of R5: a
guest's home team holds them, so nothing is revoked, and a guest whose home team no longer holds
them is revoked as FR-009 requires. It also replaces the old fallback where a failed revoke at
disconnect or removal left the grant behind: the row stays until it settles. After a deauthorization
event the revoke finds nothing left, which counts as done.

**Rationale**: the gateway is the one place that knows every team and already holds a secret per
team. Asking at the moment of withdrawal needs no copy of who is where. The yes/no crossing teams
(FR-012) is the least that can decide it. Keeping the token only until it's settled is deletion
work, not new use: it is read for nothing but the revoke.

**Alternatives considered**:
- Deciding from Strava's club list (revoke only if the person is in no team's club): needs a club
  request blocked people mustn't get (feature 025), can't check someone without the `read` scope,
  and leaves a grant behind for a club member of another team who never connected there.
- A registry of who is where, kept in the gateway: a copy of rider IDs across teams that has to
  stay right on every connect and delete; the question at withdrawal time needs none.
- Revoking at once and accepting the damage: a rider who opens another team's sign-in loses their
  home team (what happened in production, R1).
