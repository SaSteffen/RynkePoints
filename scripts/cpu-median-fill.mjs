#!/usr/bin/env node
// The one-time fill of the CPU medians (feature 049 contracts/fill-task.md,
// FR-015 to FR-017). For one team's database it finds this season's CPU days
// without a median, asks Cloudflare for each of those days with the app's own
// CPU query, and writes the median into the rows that still lack one. It
// never inserts a row and never touches another figure or a median already
// set, so a second run fills nothing. Not imported by src/, not run by CI;
// delete it once it has run on every team. The token is never printed.
//
//   CLOUDFLARE_ANALYTICS_TOKEN=… CLOUDFLARE_ANALYTICS_ACCOUNT_ID=… \
//     pnpm cpu:fill-median --team <id> (--local | --remote)
//
// --local is Wrangler's local state of that team (the one `pnpm dev:strava`
// uses); --remote is the team's production database, through the
// maintainer's Wrangler login.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WRANGLER = join(ROOT, "node_modules", ".bin", "wrangler");

/** Stops before reading or writing anything. */
function refuse(line) {
	console.error(line);
	process.exit(2);
}

/** `wrangler d1 execute DB` on the team's database; its JSON answer. */
function d1(team, where, args) {
	const out = execFileSync(
		WRANGLER,
		["d1", "execute", "DB", "--env", team, where, "--json", "--yes", ...args],
		{ cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
	return JSON.parse(out);
}

/** Wrangler's error text, from its JSON on stdout or from stderr. */
function failureOf(error) {
	return `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
}

async function main() {
	const argv = process.argv.slice(2);
	// The app's TypeScript, run by Node as is: extensionless relative imports
	// resolve to .ts, as in scripts/sandbox-usage.mjs.
	registerHooks({
		resolve(specifier, context, next) {
			return specifier.startsWith(".") && !/\.(ts|mjs|js|json)$/.test(specifier)
				? next(`${specifier}.ts`, context)
				: next(specifier, context);
		},
	});
	const { TEAMS } = await import("../src/teams/index.ts");
	const { CPU_QUERY, cpuByOwner, parseCpu, seasonOf } = await import(
		"../src/usage/cpu.ts"
	);
	const { queryCloudflare } = await import("../src/usage/cloudflare.ts");

	const ids = TEAMS.map((t) => t.id);
	const teamAt = argv.indexOf("--team");
	const team = teamAt === -1 ? undefined : argv[teamAt + 1];
	if (argv.filter((a) => a === "--team").length !== 1 || !ids.includes(team)) {
		refuse(`Name exactly one team: --team ${ids.join("|")}`);
	}
	const local = argv.includes("--local");
	const remote = argv.includes("--remote");
	if (local === remote) refuse("Name exactly one of --local and --remote.");
	const env = {
		CLOUDFLARE_ANALYTICS_TOKEN: process.env.CLOUDFLARE_ANALYTICS_TOKEN,
		CLOUDFLARE_ANALYTICS_ACCOUNT_ID:
			process.env.CLOUDFLARE_ANALYTICS_ACCOUNT_ID,
	};
	if (!env.CLOUDFLARE_ANALYTICS_TOKEN || !env.CLOUDFLARE_ANALYTICS_ACCOUNT_ID) {
		refuse(
			"CLOUDFLARE_ANALYTICS_TOKEN and CLOUDFLARE_ANALYTICS_ACCOUNT_ID must be set.",
		);
	}
	const where = local ? "--local" : "--remote";
	const now = Math.floor(Date.now() / 1000);
	const today = new Date(now * 1000).toISOString().slice(0, 10);
	const season = seasonOf(today);

	let missing;
	try {
		const [answer] = d1(team, where, [
			"--command",
			`SELECT day, owner FROM usage_cpu_daily WHERE cpu_p50_us IS NULL AND day >= '${season.from}' AND day < '${today}' ORDER BY day`,
		]);
		missing = answer?.results ?? [];
	} catch (error) {
		const failure = failureOf(error);
		console.error(
			/no such (column|table)/i.test(failure)
				? "The release adding the median isn't applied to this database yet."
				: `Wrangler failed: ${failure.trim()}`,
		);
		process.exit(1);
	}
	const lacking = new Set(missing.map((r) => `${r.day} ${r.owner}`));
	const owners = [
		...new Set([...ids, "shared", ...missing.map((r) => r.owner)]),
	];
	const filled = new Map(owners.map((o) => [o, 0]));
	const statements = [];
	const answered = [];
	// Only the days with a median to fill, one request each: a second run asks
	// nothing at all.
	for (const day of new Set(missing.map((r) => r.day))) {
		const answer = await queryCloudflare(env, now, CPU_QUERY, {
			from: day,
			to: day,
		});
		const scripts = answer.kind === "ok" ? parseCpu(answer.body) : null;
		const days = scripts ? cpuByOwner(scripts, TEAMS) : [];
		// A day refused or without any figures is one Cloudflare no longer holds.
		if (days.length === 0) continue;
		answered.push(day);
		for (const record of days) {
			if (record.day !== day || !lacking.has(`${day} ${record.owner}`))
				continue;
			statements.push(
				`UPDATE usage_cpu_daily SET cpu_p50_us = ${Math.round(record.p50Us)} WHERE day = '${day}' AND owner = '${record.owner}' AND cpu_p50_us IS NULL;`,
			);
			filled.set(record.owner, (filled.get(record.owner) ?? 0) + 1);
		}
	}
	if (statements.length > 0) {
		const dir = mkdtempSync(join(tmpdir(), "cpu-median-"));
		const file = join(dir, "fill.sql");
		try {
			writeFileSync(file, `${statements.join("\n")}\n`);
			d1(team, where, ["--file", file]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}
	const span =
		answered.length === 0
			? "Cloudflare answered for none of them"
			: `Cloudflare answered ${answered[0]} … ${answered[answered.length - 1]}`;
	console.log(
		`${team} (${local ? "local" : "remote"}): ${missing.length} days without a median, ${span}`,
	);
	const width = Math.max(...owners.map((o) => o.length));
	for (const owner of owners) {
		console.log(`  ${owner.padEnd(width)}  ${filled.get(owner)} days filled`);
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
