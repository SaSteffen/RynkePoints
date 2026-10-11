#!/usr/bin/env node
// Gathers what Strava's Developer Program form asks for
// (docs/strava-developer-program.md) into strava-review/<date>/, which git
// ignores:
//
// - screenshots of every page with Strava data, in fake mode with synthetic
//   riders, German and English, phone and desktop (e2e/strava-review.review.ts);
// - screenshots.pdf: those screenshots in one file, for the form's single
//   "App Images" upload;
// - application.md: the form's fields, drafted from the code (scopes, Strava
//   requests, webhooks, brand assets) and, with --remote, from production
//   (connected riders, consents, Strava usage and limits), the checks that
//   stay manual, and the screenshots.
//
// --remote only reads production's D1 (SELECT, through Wrangler's login); it
// writes nothing. Like the other scripts here it is a manual maintainer task.
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
if (remote) {
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

// The form's description, short: the reviewer reads many of these. The
// technical detail stays in application.md, folded away, in case Strava asks.
const description = `RynkePoints turns the rides of one charity cycling team (Team Rynkeby Hamburg, under 100 riders, all members of the team's Strava club) into training points. Each rider sees their own rides; the team sees everyone's points without names; the organisers see first names.

Riders agree before connecting. We read only each ride's key figures (distance, time, elevation), never GPS tracks, maps, photos or health data. New rides arrive through the webhook; we don't poll. Leaving the app, deauthorising it on Strava or leaving the club deletes all of the rider's data.`;

// The pictures, per language and page, in the order they were taken.
const pages = [
	...Map.groupBy(shots, (s) => {
		const [lang, , name] = s.file.split("/");
		return `${lang}/${name}`;
	}).values(),
].map((group) => {
	const image = (size) => group.find((s) => s.file.split("/")[1] === size);
	return {
		lang: group[0].file.split("/")[0],
		path: group[0].path,
		what: group[0].what,
		desktop: image("desktop")?.file,
		phone: image("phone")?.file,
	};
});
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
			p.desktop && `![${p.what}, desktop](${p.desktop})`,
			p.phone &&
				folded(
					"Phone",
					`<img src="${p.phone}" width="390" alt="${p.what}, phone">`,
				),
		]
			.filter(Boolean)
			.join("\n\n"),
	)
	.join("\n\n");
const germanGallery = folded(
	"German pages",
	german
		.map((p) => `\`${p.path}\`\n\n![${p.what}](${p.desktop ?? p.phone})`)
		.join("\n\n"),
);

// The form takes one file for "App Images", so the English pictures go into
// one PDF: an overview, then one sheet per page, desktop and phone side by
// side. A page taller than the sheet shows its top.
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
.shots{flex:1;min-height:0;display:flex;gap:6mm;align-items:flex-start}
.frame{max-height:100%;overflow:hidden;border:1px solid #ccc}
.frame img{display:block;width:100%}
.desktop{width:68%}.phone{width:24%}
</style>
<h1>RynkePoints: where Strava data is shown</h1>
<p>Every page that shows Strava data or data derived from it, with made-up
sample riders. Each page carries the "Powered by Strava" logo.</p>
<table>
<tr><th>#</th><th>Page</th><th>What it shows, and to whom</th></tr>
${english.map((p, i) => `<tr><td>${i + 1}</td><td><code>${text(p.path)}</code></td><td>${text(p.what)}</td></tr>`).join("\n")}
</table>
${english
	.map(
		(p, i) => `<section>
<h2>${i + 1}. ${text(p.path)}</h2>
<p>${text(p.what)}</p>
<div class="shots">
${p.desktop ? `<div class="frame desktop"><img src="${p.desktop}" alt=""></div>` : ""}
${p.phone ? `<div class="frame phone"><img src="${p.phone}" alt=""></div>` : ""}
</div>
</section>`,
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
| Number of Intended Users | 100 |
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
