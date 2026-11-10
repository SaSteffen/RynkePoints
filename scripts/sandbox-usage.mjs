#!/usr/bin/env node
// The usage check before a sandbox deployment writes anything (feature 027
// contracts/sandbox-workflow.md "Usage check", FR-033, FR-034). Reads the
// account's figures for today from Cloudflare, prints one line per figure and
// exits 1 when the deployment must stop: an allowance past half, figures
// unavailable, or the sandbox databases' rows written today plus the seed past
// the daily budget. Without the secrets it stops, saying the figures are
// unavailable. The token is never printed.
//
//   CLOUDFLARE_ANALYTICS_TOKEN=… CLOUDFLARE_ANALYTICS_ACCOUNT_ID=… \
//     node scripts/sandbox-usage.mjs --seed-rows <n>
//
// <n> is the seed's rows: `scripts/sandbox-seed.sh count base.sql`.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./team-check.mjs";

const ROOT = new URL("../", import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, ROOT));

/** The `--seed-rows` value, or null when missing or not a whole number. */
export function seedRows(argv) {
	const at = argv.indexOf("--seed-rows");
	const value = at === -1 ? "" : (argv[at + 1] ?? "");
	return /^\d+$/.test(value) ? Number(value) : null;
}

/** The D1 database IDs of every `sandbox-*` block of wrangler.jsonc. */
export function sandboxDatabaseIds(wrangler) {
	return Object.entries(wrangler.env ?? {})
		.filter(([name]) => name.startsWith("sandbox-"))
		.flatMap(([, block]) => block.d1_databases ?? [])
		.map((database) => database.database_id)
		.filter((id) => typeof id === "string");
}

async function main() {
	const rows = seedRows(process.argv);
	if (rows === null) {
		console.error("--seed-rows needs a whole number");
		process.exit(2);
	}
	// The app's TypeScript, run by Node as is: extensionless relative imports
	// resolve to .ts, as in scripts/team-check.mjs.
	registerHooks({
		resolve(specifier, context, next) {
			return specifier.startsWith(".") && !/\.(ts|mjs|js|json)$/.test(specifier)
				? next(`${specifier}.ts`, context)
				: next(specifier, context);
		},
	});
	const { fetchCloudflareUsage } = await import("../src/usage/cloudflare.ts");
	const { sandboxUsageVerdict } = await import("../dev/sandbox-usage.ts");
	const wrangler = parseJsonc(readFileSync(path("wrangler.jsonc"), "utf8"));
	const result = await fetchCloudflareUsage(
		{
			CLOUDFLARE_ANALYTICS_TOKEN: process.env.CLOUDFLARE_ANALYTICS_TOKEN,
			CLOUDFLARE_ANALYTICS_ACCOUNT_ID:
				process.env.CLOUDFLARE_ANALYTICS_ACCOUNT_ID,
		},
		Math.floor(Date.now() / 1000),
	);
	const verdict = sandboxUsageVerdict(
		result,
		rows,
		sandboxDatabaseIds(wrangler),
	);
	for (const line of verdict.lines) console.log(line);
	if (!verdict.go) {
		console.error("Stopped: the sandbox deployment writes nothing.");
		process.exit(1);
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
