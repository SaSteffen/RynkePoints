import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
	parseJsonc,
	placeholderProblems,
	teamProblems,
} from "../../scripts/team-check.mjs";
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

// A sandbox block (feature 027 contracts/sandbox-config.md, FR-012) runs fake
// mode on its own Worker, database, queue and host, with the team's settings.
// Anything that could let it reach production, or a sandbox that isn't the
// team's, fails the checks.
describe(`sandbox-${team.id}'s block (027 FR-012)`, () => {
	const name = `sandbox-${team.id}`;
	const where = `wrangler.jsonc: env.${name}`;
	type Sandbox = Record<string, unknown> & {
		vars: Record<string, string>;
		d1_databases: [{ database_name: string; database_id: string }];
		queues: {
			producers: [{ queue: string }];
			consumers: [{ queue: string }];
		};
		routes: { pattern: string }[];
	};

	/** The problems after `change` edits a copy of the sandbox's block. */
	function problemsWith(change: (block: Sandbox, copy: Wrangler) => void) {
		const copy = structuredClone(wrangler);
		change(copy.env[name] as unknown as Sandbox, copy);
		return teamProblems(TEAMS, copy, options);
	}

	it("is there, and passes as it is", () => {
		expect(wrangler.env[name]).toBeDefined();
		expect(
			teamProblems(TEAMS, wrangler, options).filter((l) => l.includes(name)),
		).toEqual([]);
	});

	it("names a sandbox of no registered team", () => {
		const problems = problemsWith((block, copy) => {
			copy.env["sandbox-atlantis"] = block as unknown as Block;
		});
		expect(problems).toContain(
			'wrangler.jsonc: env.sandbox-atlantis: no registered team "atlantis"',
		);
	});

	it("names an entry other than fake mode's", () => {
		const problems = problemsWith((block) => {
			block.main = "src/index.ts";
		});
		expect(problems).toContain(
			`${where}: main: "src/index.ts", not "dev/worker.ts"`,
		);
	});

	it("names a cron", () => {
		const problems = problemsWith((block) => {
			block.triggers = { crons: ["17 3 * * *"] };
		});
		expect(problems).toContain(`${where}: triggers: a sandbox has no cron`);
	});

	it.each(["workers_dev", "preview_urls"])("names %s not false", (key) => {
		const problems = problemsWith((block) => {
			delete block[key];
		});
		expect(problems).toContain(`${where}: ${key}: undefined, not false`);
	});

	it.each([
		["RYNKE_FAKE_STRAVA", "local-only", `"local-only", not "sandbox"`],
		["TEAM_ID", "elsewhere", `"elsewhere", not "${team.id}"`],
		[
			"SANDBOX_HOST",
			"trhh-rynke-coins.link",
			`"trhh-rynke-coins.link", not "${name}.trhh-rynke-coins.link"`,
		],
	])("names vars.%s set wrong", (key, value, what) => {
		const problems = problemsWith((block) => {
			block.vars[key] = value;
		});
		expect(problems).toContain(`${where}: vars.${key}: ${what}`);
	});

	it("names a route other than its own host", () => {
		const problems = problemsWith((block) => {
			block.routes = [{ pattern: "trhh-rynke-coins.link" }];
		});
		expect(problems).toContain(
			`${where}: routes: ["trhh-rynke-coins.link"], not ["${name}.trhh-rynke-coins.link"]`,
		);
	});

	it.each([
		["worker", (b: Sandbox, t: Record<string, unknown>) => (b.name = t.name)],
		[
			"database",
			(b: Sandbox, t: Sandbox) =>
				(b.d1_databases[0].database_name = t.d1_databases[0].database_name),
		],
		[
			"database ID",
			(b: Sandbox, t: Sandbox) =>
				(b.d1_databases[0].database_id = t.d1_databases[0].database_id),
		],
		[
			"queue",
			(b: Sandbox, t: Sandbox) =>
				(b.queues.producers[0].queue = t.queues.producers[0].queue),
		],
	] as const)("names a %s shared with the team's block", (kind, share) => {
		const problems = problemsWith((block, copy) => {
			share(block, copy.env[team.id] as unknown as Sandbox);
		});
		expect(
			problems.some((l) =>
				l.match(
					new RegExp(`^${where}: ${kind}: ".*" is also env\\.${team.id}'s$`),
				),
			),
		).toBe(true);
	});

	it("names a resource shared with another sandbox", () => {
		const problems = problemsWith((block, copy) => {
			const other = structuredClone(block);
			copy.env["sandbox-twin"] = other as unknown as Block;
		});
		expect(problems).toContain(
			`${where}: worker: "rynke-points-${name}" is also env.sandbox-twin's`,
		);
	});

	it("names a var that differs from the team's", () => {
		const problems = problemsWith((block) => {
			block.vars.BADGES = block.vars.BADGES === "on" ? "off" : "on";
		});
		expect(problems.some((l) => l.startsWith(`${where}: vars.BADGES: `))).toBe(
			true,
		);
	});

	it.each(["SEASON_START_DATE", "ACCESS_AUD", "ACCESS_TEAM_DOMAIN"])(
		"names a missing var %s",
		(key) => {
			const problems = problemsWith((block) => {
				delete block.vars[key];
			});
			expect(problems).toContain(`${where}: vars.${key}: missing`);
		},
	);

	it("refuses it as a deployable team", () => {
		expect(placeholderProblems(TEAMS, name)).toEqual([
			`env.${name}: a sandbox, deployed only by the Sandbox workflow`,
		]);
	});
});
