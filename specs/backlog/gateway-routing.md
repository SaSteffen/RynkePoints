# Gateway routing

Prompt for `/speckit.specify`:

"Specify how the Strava gateway (feature 026) sends each Strava event only to the
teams that hold that athlete, instead of to every team. Today every event goes to
every team, and a team that doesn't know the athlete drops it. With many teams,
that sends every rider's event to every other team's app. The goal is data
minimisation more than cost: on Cloudflare's paid plan, which a third team
needs anyway, broadcasting costs cents.

The gateway would need to know which teams hold which athletes. Each team's own
database stays the real record, and whatever the gateway keeps is only a copy of
it. Decide how that copy is kept up to date (for example, teams telling the
gateway when someone connects, plus a regular full list from every team) and
what happens when it's wrong or missing. Missing an entry must never lose an
event: an athlete the gateway doesn't know still goes to every team. A gateway
that only learns from the teams' replies was considered and set aside, because
it can't notice a rider joining a second team.

Cover guests (feature 041): a guest is held by their home team and the team they
visit, and both must keep getting their events. The check before withdrawing a
person's Strava access, which asks whether another team still holds them, keeps
asking the teams, not the copy, and its answer still never names a team.

This is the gateway's first rider data, so it changes feature 026's promise that
the gateway holds none. Say what it keeps, where (EU, like the teams' databases),
for how long, who can see it, and what the privacy notice tells riders."

Issue #400. Not before the move to Cloudflare's paid plan, which comes with the third team.
