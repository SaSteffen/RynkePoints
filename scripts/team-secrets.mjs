#!/usr/bin/env node
// Sets a team's production Worker secrets, records every value in .dev.vars
// first, and gives the gateway the team's webhook token (docs/add-a-team.md
// steps 4 and 5). A manual step for the Strava owner: it writes to Cloudflare
// and sets the Strava application's credentials.
//
//   node scripts/team-secrets.mjs <team>      e.g. europe
//
// Values come from, in this order:
// - a record of an earlier run in .dev.vars, as a comment line
//   `# prod.<team>.<NAME>=<value>` (`prod.shared.` for the usage exchange
//   token), so running it again sets the same values and loses nothing;
// - .dev.vars' own STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and
//   CLOUDFLARE_ANALYTICS_*: the shared Strava application and the read-only
//   analytics token;
// - a fresh value. A secret already on the Worker with no record here is kept
//   as it is, never replaced by an unknown new one.
// The records are comments, so `pnpm dev:strava` doesn't load them. .dev.vars
// is copied to .dev.vars.bak-<time> before the first change. Both are
// git-ignored; never commit them.
//
// USAGE_EXCHANGE_TOKEN must be the same on every team. Without a record, a new
// one goes to every team, replacing any old one: it only guards the hourly
// usage exchange between the teams.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

process.chdir(new URL("..", import.meta.url).pathname);

const die = (message) => {
	console.error(message);
	process.exit(1);
};

const team = process.argv[2];
// Every team's TEAM_ID, which is also its `--env` (a sandbox repeats its team's).
const teams = [
	...new Set(
		[
			...readFileSync("wrangler.jsonc", "utf8").matchAll(
				/"TEAM_ID": "([a-z][a-z0-9-]*)"/g,
			),
		].map((m) => m[1]),
	),
];
if (!teams.includes(team)) {
	die(`Usage: node scripts/team-secrets.mjs <${teams.join("|")}>`);
}
if (!existsSync(".dev.vars")) die("No .dev.vars to record the values in");

const devVars = readFileSync(".dev.vars", "utf8");
const own = {};
const records = {};
for (const line of devVars.split("\n")) {
	const record = line.match(/^# prod\.([a-z0-9-]+)\.([A-Z0-9_]+)=(.*)$/);
	if (record) {
		records[record[1]] ??= {};
		records[record[1]][record[2]] = record[3];
		continue;
	}
	const pair = line.match(/^([A-Z0-9_]+)=(.*)$/);
	if (pair) own[pair[1]] = pair[2].replace(/^(["'])(.*)\1$/, "$2");
}
const recorded = (scope, name) => records[scope]?.[name];

const wrangler = (args, input) =>
	spawnSync("pnpm", ["exec", "wrangler", ...args], {
		input,
		encoding: "utf8",
		stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
	});

if (wrangler(["whoami"]).status !== 0) {
	die("Wrangler isn't signed in: run pnpm exec wrangler login");
}

// The secret names on a Worker; none when it doesn't exist yet.
const secretNames = (args, label) => {
	const result = wrangler(["secret", "list", "--format", "json", ...args]);
	if (result.status !== 0) {
		if (/not found|does not exist|10007/i.test(result.stderr + result.stdout)) {
			return new Set();
		}
		die(`Couldn't list the secrets of ${label}:\n${result.stderr}`);
	}
	return new Set(JSON.parse(result.stdout).map((s) => s.name));
};

const vapidKey = async () => {
	const { privateKey } = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign"],
	);
	const { kty, crv, x, y, d } = await crypto.subtle.exportKey(
		"jwk",
		privateKey,
	);
	return JSON.stringify({ kty, crv, x, y, d });
};
const generators = {
	STRAVA_WEBHOOK_VERIFY_TOKEN: async () => randomBytes(32).toString("hex"),
	TOKEN_ENCRYPTION_KEY: async () => randomBytes(32).toString("base64"),
	SESSION_SIGNING_KEY: async () => randomBytes(32).toString("base64"),
	ADMIN_TOKEN: async () => randomBytes(32).toString("base64"),
	PUSH_VAPID_KEY: vapidKey,
};

const onWorker = secretNames(["--env", team], `team ${team}`);
const onGateway = secretNames(
	["--config", "gateway/wrangler.jsonc"],
	"the gateway",
);

const plan = []; // [what, where] lines shown before anything is written
const newRecords = []; // lines appended to .dev.vars
const teamSecrets = {};

for (const name of ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"]) {
	if (!own[name]) die(`.dev.vars has no ${name}`);
	teamSecrets[name] = own[name];
}
plan.push(`Strava application ${own.STRAVA_CLIENT_ID}, from .dev.vars`);

for (const [name, generate] of Object.entries(generators)) {
	const value = recorded(team, name);
	if (value !== undefined) {
		teamSecrets[name] = value;
		plan.push(`${name}: the recorded value`);
	} else if (onWorker.has(name)) {
		plan.push(`${name}: already on the Worker, not recorded, kept as it is`);
	} else {
		teamSecrets[name] = await generate();
		newRecords.push(`# prod.${team}.${name}=${teamSecrets[name]}`);
		plan.push(`${name}: new, recorded in .dev.vars`);
	}
}

for (const name of [
	"CLOUDFLARE_ANALYTICS_TOKEN",
	"CLOUDFLARE_ANALYTICS_ACCOUNT_ID",
]) {
	if (own[name]) {
		teamSecrets[name] = own[name];
		plan.push(`${name}: from .dev.vars`);
	}
}

let usageToken = recorded("shared", "USAGE_EXCHANGE_TOKEN");
if (usageToken === undefined) {
	usageToken = randomBytes(32).toString("base64");
	newRecords.push(`# prod.shared.USAGE_EXCHANGE_TOKEN=${usageToken}`);
	plan.push(
		`USAGE_EXCHANGE_TOKEN: new, recorded, set on ${teams.join(" and ")}`,
	);
} else {
	plan.push(
		`USAGE_EXCHANGE_TOKEN: the recorded value, on ${teams.join(" and ")}`,
	);
}
teamSecrets.USAGE_EXCHANGE_TOKEN = usageToken;

const gatewayName = `TEAM_WEBHOOK_TOKEN_${team.toUpperCase().replaceAll("-", "_")}`;
const webhookToken = teamSecrets.STRAVA_WEBHOOK_VERIFY_TOKEN;
if (webhookToken !== undefined) {
	plan.push(`gateway ${gatewayName}: the team's webhook token`);
} else if (onGateway.has(gatewayName)) {
	plan.push(`gateway ${gatewayName}: already set, kept as it is`);
} else {
	die(
		`${team}'s STRAVA_WEBHOOK_VERIFY_TOKEN is on the Worker but not recorded, so the gateway can't get the same value. Record it as "# prod.${team}.STRAVA_WEBHOOK_VERIFY_TOKEN=<value>" in .dev.vars, or delete it from the Worker, and run this again.`,
	);
}

console.log(`Team ${team} (Worker of --env ${team}):`);
for (const line of plan) console.log(`  ${line}`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("Write these to Cloudflare? [y/N] ");
rl.close();
if (!/^y$/i.test(answer.trim())) die("Nothing written.");

// Record first: a value is never on Cloudflare without being in .dev.vars.
if (newRecords.length) {
	const backup = `.dev.vars.bak-${new Date().toISOString().replaceAll(":", "-")}`;
	copyFileSync(".dev.vars", backup);
	const header = devVars.includes(`# prod.${team}.`)
		? []
		: [
				"",
				`# Production secrets of team ${team}, by scripts/team-secrets.mjs. Never commit.`,
			];
	writeFileSync(
		".dev.vars",
		`${devVars.replace(/\n*$/, "\n")}${[...header, ...newRecords].join("\n")}\n`,
	);
	console.log(
		`Recorded ${newRecords.length} new value(s); backup in ${backup}`,
	);
}

const bulk = (args, secrets, label) => {
	const result = wrangler(["secret", "bulk", ...args], JSON.stringify(secrets));
	process.stdout.write(result.stdout);
	if (result.status !== 0) {
		die(`Setting the secrets of ${label} failed:\n${result.stderr}
The values are recorded in .dev.vars; run this again to retry.`);
	}
	console.log(`Set ${Object.keys(secrets).join(", ")} on ${label}`);
};

bulk(["--env", team], teamSecrets, `team ${team}`);
for (const other of teams.filter((t) => t !== team)) {
	bulk(["--env", other], { USAGE_EXCHANGE_TOKEN: usageToken }, `team ${other}`);
}
if (webhookToken !== undefined) {
	bulk(
		["--config", "gateway/wrangler.jsonc"],
		{ [gatewayName]: webhookToken },
		"the gateway",
	);
}
console.log("Done.");
