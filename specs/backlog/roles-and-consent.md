# Prompt: roles and consent

Run first (see [README.md](README.md)).

```text
Specify roles and rider consent for RynkePoints, before the app has users.

Read first: .specify/memory/constitution.md (Principle I), specs/001-strava-connect-webhook/spec.md
(connect flow, Team Settings, FR-028 languages), specs/003-rynke-evaluation/spec.md
(FR-006a, FR-010, FR-012, FR-015, FR-024, Assumptions), specs/backlog/*.md (the features
that will use these roles and consents).

Goal: find out now which permissions the planned features need, so the connect flow
asks for them from day one instead of re-asking every rider later.

Roles:
- Two roles: rider (every connected club member) and organiser. An organiser is also
  a rider and signs in through Strava like everyone else; no passwords.
- Proposed assignment: a list of organiser Strava athlete IDs in deployment
  configuration, stored as a secret (the repo is public; IDs are personal data). No
  in-app promotion. Decide whether organisers need finer rights (e.g. only some may
  change rules or start a recalculation).

Consents (constitution Principle I, Strava API Agreement: a rider's Strava data may
only be shown to that rider unless they explicitly consent to share it):
- Inventory what each planned feature shows to whom: organisers see connected
  riders' names to record attendance (organiser-admin); organisers see balances and
  who qualified (organiser overview); all team members see a leaderboard
  (team-leaderboard); points written into Strava descriptions (activity:write,
  already its own consent). Decide the consent levels from that (e.g. "share with
  organisers", "share with the team"), whether points derived from Strava data count
  as Strava data, and what a non-consenting rider looks like in each view.
- Consent is asked in the connect flow, can be changed or withdrawn by the rider at
  any time, takes effect immediately, and is recorded with its date. Withdrawing
  never deletes points, it only hides them.
- Check Strava's API Agreement and API Policy for leaderboards, clubs and derived
  data, and whether the app needs Strava's review or a higher athlete capacity
  before more than a handful of riders can connect. Record the findings with links;
  if the leaderboard is not allowed, say so plainly, since it is the app's purpose.

Out of scope: the pages that use the roles and consents (separate backlog specs).
Rider-facing text in German and English via the i18n catalogs.
```
