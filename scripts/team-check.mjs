#!/usr/bin/env node
// Checks every registered team's data (feature 026 contracts/team-data.md,
// FR-021, FR-053): both halves, the typed module in src/teams/<id>.ts and the
// team's block of wrangler.jsonc (the top level for the founding team,
// `env.<id>` for every other). Prints one line per problem and exits 1 if
// there is any. `pnpm lint` runs it.
//
//   node scripts/team-check.mjs                    # every team
//   node scripts/team-check.mjs --deployable <id>  # also: no placeholders left
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, ROOT));

// The app's sources import without file extensions (some names have a dot,
// like `hamburg.de`), so `.ts` is added here; Node strips the types.
registerHooks({
	resolve(specifier, context, next) {
		return specifier.startsWith(".") && !/\.(ts|mjs|js|json)$/.test(specifier)
			? next(`${specifier}.ts`, context)
			: next(specifier, context);
	},
});

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
	"otherClubIds",
	"dev",
	"placeholders",
];

/** The test server's ports (`pnpm test:e2e:server`), never a team's. */
const RESERVED_PORTS = [8797, 9237];

/**
 * Every problem with `teams` against `wrangler`, one line each. `publicFile`
 * says whether `/x/y.svg` exists under public/, `locales` are the shipped ones.
 */
export function teamProblems(teams, wrangler, { locales, publicFile }) {
	const problems = [];
	const say = (team, field, what) =>
		problems.push(`team ${team?.id ?? "?"}: ${field}: ${what}`);
	const founding = teams[0];
	const reference = wrangler.vars ?? {};
	const secrets = wrangler.secrets?.required ?? [];

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
					say(team, `dev.${key}`, `${port} is the test server's`);
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

		const block = team === founding ? wrangler : wrangler.env?.[team.id];
		const where = team === founding ? "wrangler.jsonc" : `env.${team.id}`;
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
		for (const binding of ["d1_databases", "queues", "triggers"]) {
			if (block[binding] === undefined)
				say(team, `${where} ${binding}`, "missing");
		}
		if (team !== founding && block.routes === undefined) {
			say(
				team,
				`${where} routes`,
				"missing (it would inherit the founding team's)",
			);
		}
	}

	for (const id of Object.keys(wrangler.env ?? {})) {
		if (!seenIds.has(id)) {
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
	return problems;
}

/** `--deployable <id>`: the team's placeholders, one line each. */
export function placeholderProblems(teams, id) {
	const team = teams.find((t) => t.id === id);
	if (!team) return [`team ${id}: not registered`];
	return (team.placeholders ?? []).map(
		(name) => `team ${id}: ${name}: still a placeholder`,
	);
}

async function main() {
	const { TEAMS } = await import("../src/teams/index.ts");
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
