# Requirements background

Original idea (2026-10-06), as stated by the project owner:

- An app that integrates with **Strava**: if a rider allows it, fetch their
  activities and gather key data such as distance, date, and elevation gain.
- Record whether a rider took part in a **specific event**, if that can be
  determined.
- Store the data in a database.
- Build a **gamified points system** ("Rynke Points") on top of that data.
- If the rider allows it, **edit the activity description** on Strava and write the
  gained Rynke Points into it (details to be decided later).
- Run in the cloud, ideally serverless → chosen: Cloudflare Workers + D1 + Queues.

Context: Team Rynkeby Hamburg (charity cycling team). Sibling project:
[RkbyMemberMapGenerator](https://github.com/SaSteffen/RkbyMemberMapGenerator).

## Known constraints (checked 2026-10-06)

- Strava apps start at an athlete capacity of 1 (the developer). A self-serve upgrade
  gives 10; more requires Strava's Developer Program review (brand guidelines,
  screenshots of where Strava data is shown).
- Strava's API Agreement (effective 2026-06-01): a rider's data may only be shown to
  that rider unless they explicitly consent to sharing → team leaderboards need an
  explicit opt-in.
- Rate limits: 200 req / 15 min and 2,000 / day overall; 100 / 15 min and 1,000 / day
  for reads. Use webhooks, not polling.
- Strava has no "took part in event X" field — participation must be inferred (own
  event table matched by date/time window and start area, Strava club events, or a
  tag in the activity name).
- Editing descriptions needs the `activity:write` scope, which riders can decline
  separately from read access.
