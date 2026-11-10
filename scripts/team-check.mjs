#!/usr/bin/env node
// Checks every registered team's data (feature 026 contracts/team-data.md,
// FR-021, FR-053): both halves, the typed module in src/teams/<id>.ts and the
// team's block of wrangler.jsonc, `env.<id>`. Prints one line per problem and
// exits 1 if there is any. `pnpm lint` runs it.
//
//   node scripts/team-check.mjs                    # every team
//   node scripts/team-check.mjs --deployable <id>  # also: no placeholders left
//
// It checks the release sandboxes' blocks, `sandbox-<team>`, too (feature 027
// FR-012), and `--deployable` refuses them.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, ROOT));

/** JSONC to JSON: comments and trailing commas out, strings untouched. */
export function parseJsonc(text) {
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			let j = i + 1;
			while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
			out += text.slice(i, j + 1);
			i = j;
		} else if (c === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") i++;
			out += "\n";
		} else if (c === "/" && text[i + 1] === "*") {
			i = text.indexOf("*/", i + 2) + 1;
		} else {
			out += c;
		}
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/** The fields every `TeamData` has (src/teams/types.ts). */
const FIELDS = [
	"id",
	"name",
	"shortName",
	"defaultLocale",
	"foreignLocale",
	"rules",
	"eventKinds",
	"colours",
	"art",
	"phrases",
	"badgeNames",
	"holidays",
	"otherClubIds",
	"dev",
	"cloudflare",
	"placeholders",
];

/**
 * Never a team's: the local gateway's and the fake Strava's (`pnpm dev`, feature
 * 026 contracts/dev-commands.md) and the test servers' (`pnpm test:e2e:server`,
 * `:europe`).
 */
const RESERVED_PORTS = [8791, 9232, 8792, 9233, 8797, 9237, 8798, 9238];

/**
 * A release sandbox's block, `sandbox-<team>` (feature 027): fake mode, not a
 * team, checked by its own rules.
 */
export const isSandbox = (name) => name.startsWith("sandbox-");

/** What only a team's Wrangler block may hold, never the top level. */
const TEAM_KEYS = ["vars", "secrets", "d1_databases", "queues", "triggers"];

/**
 * Every problem with `teams` against `wrangler`, one line each. `publicFile`
 * says whether `/x/y.svg` exists under public/, `locales` are the shipped ones.
 */
export function teamProblems(teams, wrangler, { locales, publicFile }) {
	const problems = [];
	const say = (team, field, what) =>
		problems.push(`team ${team?.id ?? "?"}: ${field}: ${what}`);
	const founding = teams[0];
	const blocks = Object.entries(wrangler.env ?? {})
		.filter(([name]) => !isSandbox(name))
		.map(([, block]) => block);
	// Every var and secret some team's block sets, so one missing from any
	// block is caught.
	const reference = Object.assign(
		{},
		...blocks.map((block) => block.vars ?? {}),
	);
	const secrets = [
		...new Set(blocks.flatMap((block) => block.secrets?.required ?? [])),
	];

	// The top level holds no team: a command without `--env` must not reach a
	// team's Worker, database, queue or domain. Wrangler would inherit `main`,
	// `name` and `routes` into a block that doesn't set them, so every block
	// sets them itself.
	for (const key of [...TEAM_KEYS, "routes", "route"]) {
		if (wrangler[key] !== undefined) {
			problems.push(
				`wrangler.jsonc: top level: ${key} belongs in a team's block`,
			);
		}
	}
	const workers = blocks.map((block) => block.name);
	if (workers.includes(wrangler.name)) {
		problems.push(
			`wrangler.jsonc: top level: name "${wrangler.name}" is a team's Worker`,
		);
	}
	if (blocks.some((block) => block.main === wrangler.main)) {
		problems.push(
			`wrangler.jsonc: top level: main "${wrangler.main}" is a team's, so a deploy without --env would work`,
		);
	}

	const seenIds = new Set();
	const seenPorts = new Map();
	for (const team of teams) {
		for (const field of FIELDS) {
			if (team[field] === undefined) say(team, field, "missing");
		}
		if (typeof team.id !== "string" || !/^[a-z]+$/.test(team.id)) {
			say(team, "id", `"${team.id}" isn't [a-z]+`);
		}
		if (seenIds.has(team.id)) say(team, "id", "registered twice");
		seenIds.add(team.id);

		for (const field of ["defaultLocale", "foreignLocale"]) {
			if (team[field] !== undefined && !locales.includes(team[field])) {
				say(team, field, `"${team[field]}" isn't a shipped locale`);
			}
		}
		for (const field of ["phrases", "badgeNames"]) {
			const mode = team[field];
			if (mode?.kind === "own" && !locales.includes(mode.locale)) {
				say(team, field, `"${mode.locale}" isn't a shipped locale`);
			}
		}

		const rules = team.rules ?? [];
		if (team.rules !== undefined && rules.length === 0) {
			say(team, "rules", "empty");
		}
		for (let i = 1; i < rules.length; i++) {
			const [before, after] = [rules[i - 1], rules[i]];
			if (
				after.effectiveDate < before.effectiveDate ||
				after.version <= before.version
			) {
				say(team, "rules", `version ${after.version} out of order`);
			}
		}

		if (team.dev) {
			const host = team === founding ? "localhost" : `${team.id}.localhost`;
			if (team.dev.host !== host) {
				say(team, "dev.host", `"${team.dev.host}", not "${host}"`);
			}
			for (const key of ["port", "inspectorPort"]) {
				const port = team.dev[key];
				if (!Number.isInteger(port)) {
					say(team, `dev.${key}`, "missing");
					continue;
				}
				if (RESERVED_PORTS.includes(port)) {
					say(team, `dev.${key}`, `${port} is a test server's`);
				}
				const other = seenPorts.get(port);
				if (other) say(team, `dev.${key}`, `${port} is also ${other}'s`);
				seenPorts.set(port, team.id);
			}
		}

		const art = team.art ?? {};
		const paths = [
			...Object.entries(art.coin ?? {}).map(([k, v]) => [`art.coin.${k}`, v]),
			...Object.entries(art.icons ?? {}).map(([k, v]) => [`art.icons.${k}`, v]),
			...Object.entries(art.badges ?? {})
				.filter(([, v]) => v !== "placeholder")
				.map(([k, v]) => [`art.badges.${k}`, v]),
		];
		for (const [field, file] of paths) {
			if (typeof file !== "string" || !publicFile(file)) {
				say(team, field, `${file} isn't under public/`);
			}
		}
		for (const field of ["coin", "icons", "badges", "teamSpecificBadges"]) {
			if (team.art && art[field] === undefined) {
				say(team, `art.${field}`, "missing");
			}
		}

		const block = wrangler.env?.[team.id];
		const where = `env.${team.id}`;
		if (!block) {
			say(team, where, "no Wrangler block");
			continue;
		}
		const vars = block.vars ?? {};
		for (const name of Object.keys(reference)) {
			if (vars[name] === undefined)
				say(team, `${where} vars.${name}`, "missing");
		}
		if (vars.TEAM_ID !== team.id) {
			say(team, `${where} vars.TEAM_ID`, `"${vars.TEAM_ID}", not "${team.id}"`);
		}
		const required = block.secrets?.required ?? [];
		for (const name of secrets) {
			if (!required.includes(name)) {
				say(team, `${where} secrets.required`, `${name} missing`);
			}
		}
		// The split of Cloudflare's figures by team (FR-040) finds the team by these.
		const cloudflare = team.cloudflare ?? {};
		if (team.cloudflare && cloudflare.worker !== block.name) {
			say(
				team,
				"cloudflare.worker",
				`"${cloudflare.worker}", not ${where}'s name "${block.name}"`,
			);
		}
		const databaseId = block.d1_databases?.[0]?.database_id;
		if (team.cloudflare && cloudflare.databaseId !== databaseId) {
			say(
				team,
				"cloudflare.databaseId",
				`"${cloudflare.databaseId}", not ${where}'s "${databaseId}"`,
			);
		}
		if (
			team.cloudflare &&
			!(
				Array.isArray(cloudflare.queueIds) &&
				cloudflare.queueIds.every((id) => typeof id === "string" && id !== "")
			)
		) {
			say(team, "cloudflare.queueIds", "not a list of IDs");
		}
		for (const key of [...TEAM_KEYS, "name", "main", "routes"]) {
			if (block[key] === undefined) say(team, `${where} ${key}`, "missing");
		}
	}

	for (const id of Object.keys(wrangler.env ?? {})) {
		if (!seenIds.has(id) && !isSandbox(id)) {
			problems.push(`wrangler.jsonc: env.${id}: no registered team`);
		}
	}

	for (const owner of teams) {
		for (const badge of owner.art?.teamSpecificBadges ?? []) {
			for (const team of teams) {
				if (team !== owner && team.art?.badges?.[badge] === undefined) {
					say(team, `art.badges.${badge}`, `missing (${owner.id}'s motif)`);
				}
			}
		}
		for (const field of ["phrases", "badgeNames"]) {
			const own = owner[field];
			if (own?.kind !== "own") continue;
			const content = own.set ?? own.names;
			for (const team of teams) {
				const mode = team[field];
				if (
					team !== owner &&
					mode?.kind === "own" &&
					(mode.set ?? mode.names) === content
				) {
					say(team, field, `uses ${owner.id}'s own set`);
				}
			}
		}
	}
	problems.push(...sandboxProblems(wrangler, [...seenIds]));
	return problems;
}

/** The domain every sandbox's host is under: `sandbox-<team>.<domain>`. */
const SANDBOX_DOMAIN = "trhh-rynke-coins.link";

/** The vars a sandbox sets itself; every other is the team's (027 FR-012). */
const SANDBOX_VARS = [
	"RYNKE_FAKE_STRAVA",
	"SANDBOX_HOST",
	"ACCESS_TEAM_DOMAIN",
	"ACCESS_AUD",
	"PUSH_SUBJECT",
	"STRAVA_RETURN_VIA",
	"USAGE_PEERS",
	"TEAM_ID",
];

/** What a block names on Cloudflare, each of which no other block may share. */
function resources(block) {
	const databases = block.d1_databases ?? [];
	const queues = [
		...(block.queues?.producers ?? []),
		...(block.queues?.consumers ?? []),
	];
	return {
		worker: [block.name],
		database: databases.map((d) => d.database_name),
		"database ID": databases.map((d) => d.database_id),
		queue: queues.map((q) => q.queue),
		host: (block.routes ?? []).map((r) => r.pattern),
	};
}

/**
 * Every problem with the sandbox blocks (feature 027 contracts/sandbox-config.md):
 * fake mode's entry, no cron, no workers.dev or preview URLs, its own host and
 * resources, and the team's settings apart from SANDBOX_VARS.
 */
function sandboxProblems(wrangler, teamIds) {
	const problems = [];
	const entries = Object.entries(wrangler.env ?? {});
	for (const [name, block] of entries) {
		if (!isSandbox(name)) continue;
		const say = (key, what) =>
			problems.push(`wrangler.jsonc: env.${name}: ${key}: ${what}`);
		const team = name.slice("sandbox-".length);
		const host = `${name}.${SANDBOX_DOMAIN}`;
		const teamBlock = teamIds.includes(team) ? wrangler.env[team] : undefined;
		if (!teamBlock) {
			problems.push(
				`wrangler.jsonc: env.${name}: no registered team "${team}"`,
			);
		}
		if (block.main !== "dev/worker.ts") {
			say("main", `"${block.main}", not "dev/worker.ts"`);
		}
		if (block.triggers !== undefined) say("triggers", "a sandbox has no cron");
		for (const key of ["workers_dev", "preview_urls"]) {
			if (block[key] !== false) say(key, `${block[key]}, not false`);
		}
		const vars = block.vars ?? {};
		const expected = {
			RYNKE_FAKE_STRAVA: "sandbox",
			TEAM_ID: team,
			SANDBOX_HOST: host,
		};
		for (const [key, value] of Object.entries(expected)) {
			if (vars[key] !== undefined && vars[key] !== value) {
				say(`vars.${key}`, `"${vars[key]}", not "${value}"`);
			}
		}
		for (const key of SANDBOX_VARS) {
			if (vars[key] === undefined) say(`vars.${key}`, "missing");
		}
		const patterns = (block.routes ?? []).map((r) => r.pattern);
		if (patterns.length !== 1 || patterns[0] !== host) {
			say("routes", `${JSON.stringify(patterns)}, not ["${host}"]`);
		}
		if (teamBlock) {
			const teamVars = teamBlock.vars ?? {};
			const keys = new Set([...Object.keys(teamVars), ...Object.keys(vars)]);
			for (const key of keys) {
				if (SANDBOX_VARS.includes(key) || vars[key] === teamVars[key]) continue;
				say(
					`vars.${key}`,
					vars[key] === undefined
						? "missing"
						: teamVars[key] === undefined
							? `not in env.${team}`
							: `"${vars[key]}", not env.${team}'s "${teamVars[key]}"`,
				);
			}
		}
		const mine = resources(block);
		for (const [other, otherBlock] of entries) {
			if (other === name) continue;
			const theirs = resources(otherBlock);
			for (const [kind, values] of Object.entries(mine)) {
				for (const value of new Set(values)) {
					if (value !== undefined && theirs[kind].includes(value)) {
						say(kind, `"${value}" is also env.${other}'s`);
					}
				}
			}
		}
	}
	return problems;
}

/**
 * `--deployable <id>`: the team's placeholders, one line each. A sandbox is
 * never deployable as a team: production's deploy job would take it.
 */
export function placeholderProblems(teams, id) {
	if (isSandbox(id)) {
		return [`env.${id}: a sandbox, deployed only by the Sandbox workflow`];
	}
	const team = teams.find((t) => t.id === id);
	if (!team) return [`team ${id}: not registered`];
	return (team.placeholders ?? []).map(
		(name) => `team ${id}: ${name}: still a placeholder`,
	);
}

/** The team registry, `TEAMS` of src/teams/index.ts, imported from Node. */
export async function loadTeams() {
	// The app's sources import without file extensions (some names have a dot,
	// like `hamburg.de`), so `.ts` is added here; Node strips the types.
	registerHooks({
		resolve(specifier, context, next) {
			return specifier.startsWith(".") && !/\.(ts|mjs|js|json)$/.test(specifier)
				? next(`${specifier}.ts`, context)
				: next(specifier, context);
		},
	});
	const { TEAMS } = await import("../src/teams/index.ts");
	return TEAMS;
}

async function main() {
	const TEAMS = await loadTeams();
	const wrangler = parseJsonc(readFileSync(path("wrangler.jsonc"), "utf8"));
	const locales = readdirSync(path("src/i18n/messages/"))
		.map((name) => name.match(/^([a-z]{2,3})\.ts$/)?.[1])
		.filter(Boolean);
	const publicFile = (file) =>
		file.startsWith("/") && existsSync(path(`public${file}`));
	const problems = teamProblems(TEAMS, wrangler, { locales, publicFile });
	const deployable = process.argv.indexOf("--deployable");
	if (deployable !== -1) {
		const id = process.argv[deployable + 1];
		problems.push(...placeholderProblems(TEAMS, id ?? ""));
	}
	for (const line of problems) console.error(line);
	process.exit(problems.length > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
