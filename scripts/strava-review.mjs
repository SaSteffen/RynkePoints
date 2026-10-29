#!/usr/bin/env node
// Gathers what Strava's Developer Program form asks for
// (docs/strava-developer-program.md) into strava-review/<date>/, which git
// ignores:
//
// - screenshots of every page with Strava data, in fake mode with synthetic
//   riders, German and English, at desktop size, a long page screenful by
//   screenful (e2e/strava-review.review.ts);
// - screenshots.pdf: those screenshots in one file, for the form's single
//   "App Images" upload;
// - application.md: the form's fields, drafted from the code (scopes, Strava
//   requests, webhooks, brand assets) and, with --remote, from production
//   (connected riders, consents, Strava usage and limits), the checks that
//   stay manual, and the screenshots.
//
// --remote only reads production's D1 (SELECT, and `d1 info` for the region
// it is stored in, through Wrangler's login); it writes nothing. Like the
// other scripts here it is a manual maintainer task.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

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
const seasonStart = read("wrangler.jsonc").match(
	/"SEASON_START_DATE": "([^"]+)"/,
)?.[1];
const contact = read("wrangler.jsonc").match(/"CONTACT_EMAIL": "([^"]+)"/)?.[1];
const deadline = read("wrangler.jsonc").match(
	/"QUALIFICATION_DEADLINE": "([^"]+)"/,
)?.[1];

// The athlete capacity asked for: the team's riders this season plus room for
// organisers and newcomers. A specific, justified number is easier to grant
// than an open-ended one.
const REQUESTED_ATHLETES = 75;

// Why each Strava request is made, for the description. A request the code
// makes that has no entry here fails the run, so the text can't fall behind.
const PURPOSES = {
	"POST /oauth/token":
		"exchanges the code after the rider connects, and refreshes the access token when it has expired",
	"POST /oauth/revoke":
		"revokes the rider's tokens when they disconnect in the app, leave the club, or don't renew a broken connection within 7 days",
	"GET /athlete/clubs":
		"checks that the rider is a member of the team's Strava club: once when connecting, then once a day",
	"GET /athlete/activities":
		"imports the rider's activities since the season start, once after connecting (and once more if we start reading a new figure), 200 per page",
	"GET /activities/{id}":
		"reads one activity after a webhook event says it was created or changed",
};
const unexplained = requests.filter((r) => !(r in PURPOSES));

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
let authenticated = "(run with --remote)";
// Where the database lives; Cloudflare picks the region when it is created.
let region =
	"[region: run with --remote, or see `wrangler d1 info rynke-points`]";
if (remote) {
	const info = JSON.parse(
		execFileSync(
			"pnpm",
			["exec", "wrangler", "d1", "info", "rynke-points", "--json"],
			{ cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
		),
	);
	const reported = info.running_in_region ?? info.region;
	if (reported) region = `Cloudflare's ${reported} region`;
	const riders = d1(`SELECT
		(SELECT COUNT(*) FROM riders WHERE status = 'connected') AS connected,
		(SELECT COUNT(*) FROM riders WHERE status = 'needs_reconnect') AS reconnect,
		(SELECT COUNT(DISTINCT athlete_id) FROM consent_records) AS consented,
		(SELECT COUNT(*) FROM activities) AS activities,
		(SELECT COUNT(*) FROM push_subscriptions) AS pushes`);
	const limit = d1("SELECT * FROM strava_rate_limit WHERE id = 1");
	const observed = new Date(limit.observed_at * 1000).toISOString();
	authenticated = String(riders.connected);
	production = `- Connected riders: ${riders.connected} (plus ${riders.reconnect} waiting to reconnect)
- Riders with a consent record: ${riders.consented}
- Stored activities: ${riders.activities}
- Push subscriptions: ${riders.pushes}
- Strava usage last seen ${observed}: read ${limit.read_daily} / ${limit.limit_read_daily} a day, overall ${limit.all_daily} / ${limit.limit_all_daily} a day
- Limits Strava last sent: read ${limit.limit_read_15m} / ${limit.limit_read_daily}, overall ${limit.limit_all_15m} / ${limit.limit_all_daily} (15 min / day)`;
}

// The form's description. Strava asks applicants which endpoints and webhooks
// they use, how long they keep data, how they handle privacy and where the
// data is processed, so it answers each of those in its own section, with the
// scopes and requests taken from the code. The production numbers stay in
// application.md, folded away, in case Strava asks.
const requestLines = requests
	.map((r) => `- ${r}: ${PURPOSES[r] ?? "(no purpose written down)"}.`)
	.join("\n");
const description = `RynkePoints supports Team Rynkeby Hamburg, a charity cycling team whose riders raise money for children with serious illnesses and ride to Paris together each summer. The app turns the team's training into points ("Rynke") and badges, so riders can see whether they will meet the team's training requirement in time. It is not commercial: no ads, no payments, no analytics or tracking, and nothing is sold or passed on.

We ask for an athlete capacity of ${REQUESTED_ATHLETES}: about 50 riders this season, all members of the team's Strava club, plus room for organisers and newcomers. Ten athletes are not enough for the team, and the riders who can't connect are training for a qualification deadline${deadline ? ` (${deadline})` : ""}, so every week without the app counts.

Privacy policy: https://trhh-rynke-coins.link/privacy, linked from every page's footer, in German and English. Support and data requests: ${contact}.

WHY AN APP OF ITS OWN, NOT STRAVA'S CLUB FEATURES
- The team's qualification rules combine two kinds of points. Training Rynke come mostly from the rider's own rides (distance and elevation). Team Rynke come only from team trainings, training weekends and technique trainings, which the organisers record in the app, not from Strava.
- Both kinds count towards the team's training requirement, with a deadline. Riders see what they still need and whether they are on pace; organisers see who needs help before the deadline.
- Strava's club features show distance and activities, but cannot combine rides with team events, apply the team's rules or track the requirement. RynkePoints does not replicate a Strava feature: it adds the team's own rules on top, and links back to Strava.

WHO CAN CONNECT AND WHAT THEY AGREE TO
- Before Strava's authorisation page, the rider reads and agrees to what is read and who sees what. We store which version of that text they agreed to and when. If the text changes, they must agree again before the app shows them anything.
- Only members of the team's Strava club can connect. For anyone else, or anyone who doesn't agree, nothing is stored.
- Scopes requested: ${scopes}. Only read and activity:read are required. Without activity:read_all, private ("Only You") activities are never stored. We request no write scope and write nothing to Strava.

STRAVA ENDPOINTS AND WEBHOOK
- One app-wide webhook subscription. New, changed and deleted activities, and deauthorisations, arrive through it. We never poll for new activities.
- The webhook answers within the 2-second limit: it checks the event and puts it in a queue, and the work happens afterwards. It never calls Strava itself.
- A deauthorisation event deletes all of the rider's data.
${requestLines}
- Every response's rate-limit headers are stored, and the work queue waits when the 15-minute or daily budget runs low, so we stay inside the limits.

WHAT WE STORE
- Per rider: Strava athlete ID, first name (for the greeting and for the organisers), the granted scopes, the access and refresh tokens (encrypted), connection status, and the consent version and time.
- Per ride, imported from the season start on${seasonStart ? ` (${seasonStart})` : ""}: activity ID, name, sport type, start time and time zone, distance, moving and elapsed time, elevation gain, and the manual, trainer, private and flagged markers.
- Per run and per swim: only activity ID, start time, distance and the private marker, for the running and swimming badges.
- Derived from these: the rider's Rynke, badges, and which rides counted and why.
- Entered by the team, not from Strava: team events a rider attended, and point corrections by organisers.
- For each device where a rider turns on notifications: only the address the device's push service gives it. The notification itself carries no content, so no data passes through the push service.
- We never read or store GPS tracks, maps, routes, segments, photos, descriptions, heart rate, power, cadence, calories or other health data, followers, or any other athlete's data. No IP addresses are stored.

WHO SEES WHAT
- Riders give their prior express consent to what is shown to the organisers and the team (API Policy section 5.13) before they connect: the landing page shows the full text and an "I agree" checkbox (first page in the screenshots), and we store which version they agreed to. Nothing is shown to anyone else without it.
- Each rider sees their own activities, including the names, and their own Rynke and badges. Activity names are shown to nobody else.
- The rest of the team sees, without names: each rider's Team Rynke and place (Team Rynke come from team events the organisers record, not from Strava), each rider's Training Rynke only as an unnamed dot in one team chart, and team totals that include them. Riders are not ranked by Training Rynke. No activities, distances, names or profile links of other riders are shown.
- The team's organisers see each rider's first name, how far they are towards the Training and the Team threshold in percent (stopping at 100 %), whether they are behind the even pace or lack outdoor rides, and the corrections organisers entered. They see no amounts derived from rides, no activity names and no individual activities' details.
- Nothing is public. Every page with rider data needs the rider to be signed in with Strava.
- No Strava data is shared with third parties or used for AI or machine learning.

HOW LONG WE KEEP IT
- The import reads only from the season start on. Stored data is kept only while the rider stays connected, and is kept up to date through the webhook: an activity deleted on Strava, or made private without activity:read_all, is removed from our database as soon as its event is processed (normally within minutes).
- All of a rider's data is deleted at once, and their tokens are revoked where they still work, when they:
  - disconnect in the app (one button);
  - remove the app in their Strava settings (webhook);
  - leave the team's Strava club (daily check: deleted within 24 hours);
  - have a broken connection they don't renew within 7 days.
- After deletion, the data remains only in the database provider's automatic point-in-time backups for at most 7 days. It is not copied anywhere else.
- Server logs contain identifiers only, never tokens or activity data, and Cloudflare keeps them for at most 7 days.

WHERE IT IS PROCESSED
- Everything runs on Cloudflare's serverless platform: Workers for the app, Queues for the work after webhook events, and D1 for the database.
- The database is stored in ${region}. Code runs in Cloudflare's data centre nearest the request.
- No other service receives Strava data.

SECURITY
- Strava tokens are encrypted at rest with AES-256-GCM. The keys and the client secret are Cloudflare secrets and never appear in code or logs.
- Sessions are signed cookies over HTTPS only. The webhook URL contains a secret, and every event's subscription ID is checked.
- The code is open source, and every change must pass automated tests, including that no token reaches the logs, that leaving deletes everything, and that activity names and organiser pages reach only those allowed to see them.`;

// The pictures, per language and page, in the order they were taken; a long
// page has several.
const pages = [
	...Map.groupBy(
		shots,
		(s) => `${s.file.split("/")[0]} ${s.path} ${s.what}`,
	).values(),
].map((group) => ({
	lang: group[0].file.split("/")[0],
	path: group[0].path,
	what: group[0].what,
	images: group.map((s) => s.file),
}));
// The review doesn't ask for every language: English is shown, German only
// in application.md, folded away.
const english = pages.filter((p) => p.lang === "en");
const german = pages.filter((p) => p.lang === "de");

const folded = (summary, body) => `<details>
<summary>${summary}</summary>

${body}

</details>`;
const overview = english
	.map((p, i) => `${i + 1}. \`${p.path}\`: ${p.what}`)
	.join("\n");
const gallery = english
	.map((p, i) =>
		[
			`### ${i + 1}. \`${p.path}\``,
			p.what,
			...p.images.map((file) => `![${p.what}](${file})`),
		].join("\n\n"),
	)
	.join("\n\n");
const germanGallery = folded(
	"German pages",
	german
		.map((p) =>
			[
				`\`${p.path}\``,
				...p.images.map((file) => `![${p.what}](${file})`),
			].join("\n\n"),
		)
		.join("\n\n"),
);

// The form takes one file for "App Images", so the English pictures go into
// one PDF: an overview, then one sheet per screenful.
const text = (s) =>
	s.replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
	);
writeFileSync(
	join(OUT, "screenshots.html"),
	`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>RynkePoints: where Strava data is shown</title>
<style>
@page{size:A4 landscape;margin:12mm}
body{font-family:system-ui,sans-serif;margin:0;color:#1c1b13;font-size:11pt}
h1{font-size:20pt}h2{font-size:14pt;margin:0 0 2mm}
p{margin:0 0 4mm}code{font-size:10pt;color:#555}
table{border-collapse:collapse;width:100%;font-size:11pt}
td,th{border-top:1px solid #ccc;padding:1.5mm 2mm;text-align:left;vertical-align:top}
section{break-before:page;height:185mm;display:flex;flex-direction:column}
section img{flex:1;min-height:0;object-fit:contain;object-position:left top;border:1px solid #ccc;max-width:100%;align-self:flex-start}
</style>
<h1>RynkePoints: where Strava data is shown</h1>
<p>Every page that shows Strava data or data derived from it, with made-up
sample riders. Each page carries the "Powered by Strava" logo in its footer.</p>
<table>
<tr><th>#</th><th>Page</th><th>What it shows, and to whom</th></tr>
${english.map((p, i) => `<tr><td>${i + 1}</td><td><code>${text(p.path)}</code></td><td>${text(p.what)}</td></tr>`).join("\n")}
</table>
${english
	.flatMap((p, i) =>
		p.images.map(
			(file, part) => `<section>
<h2>${i + 1}. ${text(p.path)}${p.images.length > 1 ? ` (${part + 1} of ${p.images.length})` : ""}</h2>
<p>${text(p.what)}</p>
<img src="${file}" alt="">
</section>`,
		),
	)
	.join("\n")}
</html>
`,
);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(join(OUT, "screenshots.html")).href);
await page.pdf({ path: join(OUT, "screenshots.pdf"), preferCSSPageSize: true });
await browser.close();

writeFileSync(
	join(OUT, "application.md"),
	`# Strava Developer Program application, ${today}

Paste these into the
[form](https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8) after checking
them. Procedure: docs/strava-developer-program.md.

## Form fields

| Field | Answer |
|---|---|
| First name, Last name, Email Address | Yours; Strava replies from developers@strava.com |
| Company Name | Team Rynkeby Hamburg |
| API Application Name | RynkePoints |
| Strava Client ID | From the [API settings](https://www.strava.com/settings/api) |
| Additional Apps | Leave empty |
| Number of Currently Authenticated Users | ${authenticated} |
| Number of Intended Users | ${REQUESTED_ATHLETES} |
| Application Description | Below |
| Support URL | https://trhh-rynke-coins.link |
| TOS Compliance | Tick after checking the [API Agreement](https://www.strava.com/legal/api) |
| API Policy Compliance | Tick after checking the [API Policy](https://www.strava.com/legal/api_policy) |
| Brand Guidelines Review | Tick after checking the [brand guidelines](https://developers.strava.com/guidelines) |
| App Images | \`screenshots.pdf\` from this folder |

### Application Description

\`\`\`text
${description}
\`\`\`

## Still manual

- [ ] The API settings page: upgraded to 10 athletes, and it says the app
      qualifies for review.
- [ ] The API Agreement, API Policy and brand guidelines: any changes since
      the date in the runbook.
- [ ] Read the Application Description against the app: the database
      region is filled in (it needs \`--remote\`), and the stored fields,
      who sees what and the deletion rules are still true.
- [ ] Look through \`screenshots.pdf\`, then submit and record the outcome
      (runbook step 8).

${folded(
	"Details, in case Strava asks",
	`**Production:**

${production}

**Scopes:** \`${scopes}\`. \`activity:write\` is optional and unused so far; it
is meant for a short section in the rider's own ride descriptions.

**Strava requests:** ${requests.map((r) => `\`${r}\``).join(", ")}.
\`GET /athlete/activities\` runs once per rider, for the season's backfill.
Every response's rate-limit headers are stored, and the work queue waits when
the budget runs low.

**Brand assets:** ${
		missingBrand.length === 0
			? `all ${brandFiles.length} official images present, unmodified, in \`public/strava/en/\`.`
			: `missing ${missingBrand.join(", ")}.`
	}`,
)}

## Screenshots

${overview}

${gallery}

${germanGallery}
`,
);

console.log(
	`\nwrote ${join("strava-review", today)}/application.md and screenshots.pdf`,
);
if (missingBrand.length > 0) process.exitCode = 1;
if (unexplained.length > 0) {
	console.error(
		`No purpose written down in PURPOSES for: ${unexplained.join(", ")}`,
	);
	process.exitCode = 1;
}
