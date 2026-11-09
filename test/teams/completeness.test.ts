import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { parseJsonc, teamProblems } from "../../scripts/team-check.mjs";
import { CATALOGS } from "../../src/i18n/catalogs";
import { TEAMS, teamFor } from "../../src/teams";
import type { TeamData } from "../../src/teams/types";

// A team's incomplete data fails the checks, naming what is missing, before
// anything is deployed (feature 026 US3 scenario 4, contracts/team-data.md ›
// `scripts/team-check.mjs`). The checks run on copies: the team this project
// runs as, with one field or var taken away.

type Block = { name?: string; main?: string; vars: Record<string, string> };
type Wrangler = Record<string, unknown> & {
	name?: string;
	main?: string;
	env: Record<string, Block>;
};

// `import.meta.glob` is declared in test/unit/dev-guard.test.ts.
const FILES = import.meta.glob("../../wrangler.jsonc", {
	query: "?raw",
	import: "default",
	eager: true,
});
const wrangler = parseJsonc(Object.values(FILES)[0] ?? "") as Wrangler;
const team = teamFor(env);
const options = {
	locales: Object.keys(CATALOGS),
	// Art paths are `pnpm lint`'s to check against public/.
	publicFile: () => true,
};

/** The registry with this team replaced by `changed`. */
function withTeam(changed: Partial<TeamData>): Partial<TeamData>[] {
	return TEAMS.map((t) => (t.id === team.id ? changed : t));
}

/** `wrangler` with `name` taken out of this team's vars. */
function withoutVar(name: string): Wrangler {
	const copy = structuredClone(wrangler);
	const block = copy.env[team.id];
	if (block) delete block.vars[name];
	return copy;
}

describe(`${team.id}'s data checks (US3 scenario 4)`, () => {
	it("finds nothing wrong with the registered data", () => {
		expect(teamProblems(TEAMS, wrangler, options)).toEqual([]);
	});

	it.each([
		"name",
		"rules",
		"colours",
		"art",
		"phrases",
		"dev",
		"cloudflare",
	] as const)("names a missing %s", (field) => {
		const { [field]: _, ...rest } = team;
		const problems = teamProblems(withTeam(rest), wrangler, options);
		expect(problems).toContain(`team ${team.id}: ${field}: missing`);
	});

	it("names Cloudflare resources that aren't the Wrangler block's (FR-040)", () => {
		const problems = teamProblems(
			withTeam({
				...team,
				cloudflare: {
					worker: "another-worker",
					databaseId: "another-id",
					queueIds: [""],
				},
			}),
			wrangler,
			options,
		);
		const lines = problems.filter((line) =>
			line.startsWith(`team ${team.id}: cloudflare.`),
		);
		expect(lines).toHaveLength(3);
	});

	it("names empty rules", () => {
		const problems = teamProblems(
			withTeam({ ...team, rules: [] }),
			wrangler,
			options,
		);
		expect(problems).toContain(`team ${team.id}: rules: empty`);
	});

	it.each([
		"BADGES",
		"PHRASES",
		"SEASON_ALBUM",
		"FUN_THEMES",
		"SEASON_START_DATE",
	])("names a missing var %s", (name) => {
		const where = `env.${team.id}`;
		const problems = teamProblems(TEAMS, withoutVar(name), options);
		expect(problems).toContain(
			`team ${team.id}: ${where} vars.${name}: missing`,
		);
	});

	// Without `--env`, Wrangler would deploy the top level under package.json's
	// name, which is Hamburg's Worker, with whatever bindings sit there.
	it.each(["vars", "secrets", "d1_databases", "queues", "triggers", "routes"])(
		"names a team's %s at the top level",
		(key) => {
			const copy = structuredClone(wrangler);
			copy[key] = copy.env[team.id]?.[key as keyof Block] ?? [];
			expect(teamProblems(TEAMS, copy, options)).toContain(
				`wrangler.jsonc: top level: ${key} belongs in a team's block`,
			);
		},
	);

	it("names a top level that would deploy as a team", () => {
		const copy = structuredClone(wrangler);
		copy.name = copy.env[team.id]?.name;
		copy.main = copy.env[team.id]?.main;
		const problems = teamProblems(TEAMS, copy, options);
		expect(problems.filter((line) => line.includes("top level"))).toHaveLength(
			2,
		);
	});

	it.each(["name", "main", "routes"])(
		"names a %s the block would inherit",
		(key) => {
			const copy = structuredClone(wrangler);
			const block = copy.env[team.id] as Record<string, unknown>;
			delete block[key];
			expect(teamProblems(TEAMS, copy, options)).toContain(
				`team ${team.id}: env.${team.id} ${key}: missing`,
			);
		},
	);
});
