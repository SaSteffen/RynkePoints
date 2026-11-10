# Sandbox configuration

Research R1, R2, R5, R8, R9.

## `wrangler.jsonc` block

One per sandbox, named `sandbox-<team>`, after the teams' blocks:

```jsonc
"sandbox-hamburg": {
	"name": "rynke-points-sandbox-hamburg",
	"main": "dev/worker.ts",
	"workers_dev": false,
	"preview_urls": false,
	"d1_databases": [{ "binding": "DB", "database_name": "rynke-points-sandbox-hamburg",
		"database_id": "<from wrangler d1 create>", "migrations_dir": "migrations" }],
	"queues": { /* producer and consumer of rynke-points-sandbox-hamburg-work,
		same settings as the team's */ },
	// no "triggers" (FR-032)
	"vars": {
		/* every var of the team's block, with the same values, except: */
		"PUSH_SUBJECT": "https://sandbox-hamburg.trhh-rynke-coins.link",
		"STRAVA_RETURN_VIA": "",
		"USAGE_PEERS": "[]",
		"TEAM_ID": "hamburg",
		"RYNKE_FAKE_STRAVA": "sandbox",
		"SANDBOX_HOST": "sandbox-hamburg.trhh-rynke-coins.link",
		"ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com",
		"ACCESS_AUD": "<the Access application's AUD tag>"
	},
	"secrets": { "required": [ /* the team's list */ ] },
	"routes": [{ "pattern": "sandbox-hamburg.trhh-rynke-coins.link", "custom_domain": true }]
}
```

`sandbox-europe` is the same with `europe`. The Access values aren't secret: the AUD tag and the
team domain only identify the application, and the check needs Access's private key to pass.

`SANDBOX_COMMIT` is not in the file; the workflow passes it with `--var`.

`dev/worker.ts`'s `DevEnv` declares `RYNKE_FAKE_STRAVA`, `SANDBOX_HOST`, `ACCESS_TEAM_DOMAIN`,
`ACCESS_AUD` and `SANDBOX_COMMIT` as optional strings. `pnpm types` adds the declared vars to
`Env`; `src/` doesn't read them.

## `team-check` rules (FR-012)

`node scripts/team-check.mjs` fails, naming the block and key, when a `sandbox-<team>` block:
- names a team that isn't in `src/teams/`;
- has `main` other than `dev/worker.ts`, any `triggers`, `workers_dev` or `preview_urls` not
  `false`, `RYNKE_FAKE_STRAVA` other than `sandbox`, or `TEAM_ID` other than `<team>`;
- has a route other than `sandbox-<team>.trhh-rynke-coins.link`, or `SANDBOX_HOST` different
  from it;
- shares its Worker name, database name, database ID, queue name or host with any team's block
  or another sandbox's;
- differs from its team's vars beyond the keys listed above, or lacks one of them.

`team-check --deployable <name>` refuses any name starting with `sandbox-`.

Tests: one fixture config per rule, each failing with its message; the real `wrangler.jsonc`
passes.

## Fake mode in a sandbox

| | Local fake mode | Sandbox |
|---|---|---|
| Hosts, access | contracts/access-check.md | contracts/access-check.md |
| Seeds on the first request | yes | no (research R6) |
| `POST /_dev/reset` | reseeds | `409`, "Deploy again to reset the sandbox (docs/sandboxes.md)" |
| `POST /_dev/scheduled` (new) | runs the daily work | runs the daily work |
| Sandbox bar on HTML pages | no | yes, with the commit (research R12) |
| `GET /_dev/` | sample riders, state, **Connect as**, a link to each rider's page; no rides read | same |
| `GET /_dev/riders/<athleteId>` (new, research R9a) | that rider's event forms, reading only their rides | same |
| Everything else on `/_dev/` | unchanged | unchanged |
