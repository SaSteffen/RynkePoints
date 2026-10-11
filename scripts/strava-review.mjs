#!/usr/bin/env node
// Gathers what Strava's Developer Program form asks for
// (docs/strava-developer-program.md) into strava-review/<date>/, which git
// ignores:
//
// - screenshots of every page with Strava data, in fake mode with synthetic
//   riders, German and English, phone and desktop (e2e/strava-review.review.ts);
// - application.md: the form answers drafted from the code (scopes, Strava
//   requests, webhooks, brand assets) and, with --remote, from production
//   (connected riders, consents, Strava usage and limits), plus the checks
//   that stay manual.
//
// --remote only reads production's D1 (SELECT, through Wrangler's login); it
// writes nothing. Like the other scripts here it is a manual maintainer task.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const remote = process.argv.includes("--remote");
const today = new Date().toISOString().slice(0, 10);
const OUT = join(ROOT, "strava-review", today);
mkdirSync(OUT, { recursive: true });

const read = (path) => readFileSync(join(ROOT, path), "utf8");

execFileSync(
	"pnpm",
	["exec", "playwright", "test", "-c", "playwright.review.config.ts"],
	{
		cwd: ROOT,
		stdio: "inherit",
		env: { ...process.env, STRAVA_REVIEW_OUT: OUT },
	},
);
const shots = JSON.parse(readFileSync(join(OUT, "screens.json"), "utf8"));

// From the code.
const scopes = read("src/http/auth.ts").match(
	/REQUESTED_SCOPES = "([^"]+)"/,
)?.[1];
const requests = [
	...new Set(
		["src/strava/client.ts", "src/strava/tokens.ts"].flatMap((file) =>
			[...read(file).matchAll(/"((?:GET|POST|PUT|DELETE) \/[^"]*)"/g)].map(
				(m) => m[1],
			),
		),
	),
].sort();
const brandFiles = [
	...new Set(
		[...read("src/i18n/messages/en.ts").matchAll(/"(\/strava\/[^"]+)"/g)].map(
			(m) => m[1],
		),
	),
];
const missingBrand = brandFiles.filter(
	(f) => !existsSync(join(ROOT, "public", f)),
);

// From production, read only.
function d1(sql) {
	const out = execFileSync(
		"pnpm",
		[
			"exec",
			"wrangler",
			"d1",
			"execute",
			"rynke-points",
			"--remote",
			"--json",
			"--command",
			sql,
		],
		{ cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
	);
	return JSON.parse(out)[0].results[0];
}

let production = "Not read: run `pnpm strava:review --remote` for the numbers.";
if (remote) {
	const riders = d1(`SELECT
		(SELECT COUNT(*) FROM riders WHERE status = 'connected') AS connected,
		(SELECT COUNT(*) FROM riders WHERE status = 'needs_reconnect') AS reconnect,
		(SELECT COUNT(DISTINCT athlete_id) FROM consent_records) AS consented,
		(SELECT COUNT(*) FROM activities) AS activities,
		(SELECT COUNT(*) FROM push_subscriptions) AS pushes`);
	const limit = d1("SELECT * FROM strava_rate_limit WHERE id = 1");
	const observed = new Date(limit.observed_at * 1000).toISOString();
	production = `- Connected riders: ${riders.connected} (plus ${riders.reconnect} waiting to reconnect)
- Riders with a consent record: ${riders.consented}
- Stored activities: ${riders.activities}
- Push subscriptions: ${riders.pushes}
- Strava usage last seen ${observed}: read ${limit.read_daily} / ${limit.limit_read_daily} a day, overall ${limit.all_daily} / ${limit.limit_all_daily} a day
- Limits Strava last sent: read ${limit.limit_read_15m} / ${limit.limit_read_daily}, overall ${limit.limit_all_15m} / ${limit.limit_all_daily} (15 min / day)`;
}

const shotList = shots
	.map((s) => `- \`${s.file}\` (${s.path}): ${s.what}`)
	.join("\n");

writeFileSync(
	join(OUT, "application.md"),
	`# Strava Developer Program application, ${today}

Gathered by \`pnpm strava:review\`; procedure in
docs/strava-developer-program.md. Check every answer before pasting it into
the form.

## Production

${production}

## Form answers (draft)

**App name:** RynkePoints

**What the app does:** A training-points app for one charity cycling team
(Team Rynkeby). Riders connect their Strava account; each ride becomes training
points ("Rynke") under the team's rules. Only members of the team's Strava
club can take part. Each rider sees their own rides; the team sees everyone's
Rynke without names, and the organisers see first names, record team events
and attendance.

**Expected athletes:** the team's riders, under 100.

**How the app uses the API:**
- Scopes requested: \`${scopes}\`
- Strava requests: ${requests.map((r) => `\`${r}\``).join(", ")}
- New and changed activities and deauthorisations arrive through Strava's
  webhook; the app doesn't poll. \`GET /athlete/activities\` runs once per rider
  for the season's backfill when they connect.
- Every response's \`X-RateLimit-*\` and \`X-ReadRateLimit-*\` headers are
  stored and the work queue waits when the budget runs low.
- Riders agree, before connecting, to what is read and who sees what; only the
  ride's key figures are read, never GPS tracks, maps, photos or health data.
  Leaving in the app, deauthorising on Strava or leaving the club deletes all
  of the rider's data.
- \`activity:write\` is optional and unused so far; it is meant for a short
  section in the rider's own ride descriptions, never changing their text.

## Brand assets

${
	missingBrand.length === 0
		? `All ${brandFiles.length} official Strava images the catalogs name are present, unmodified, in \`public/strava/en/\`.`
		: `Missing: ${missingBrand.join(", ")}`
}
The screenshots check that the landing page shows "Connect with Strava" and
every rider page shows "Powered by Strava".

## Screenshots

${shotList}

## Still manual

- [ ] The API settings page: upgraded to 10 athletes, and it says the app
      qualifies for review.
- [ ] The API Agreement (https://www.strava.com/legal/api): any changes since
      the date in the runbook.
- [ ] The brand guidelines (https://developers.strava.com/guidelines): any
      changes since the date in the runbook.
- [ ] Submit the form with the screenshots, then record the outcome (runbook
      step 8).
`,
);

console.log(`\nwrote ${join("strava-review", today)}/application.md`);
if (missingBrand.length > 0) process.exitCode = 1;
