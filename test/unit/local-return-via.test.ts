import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../scripts/team-check.mjs";

// Local sign-ins never go through the production gateway (fix of 2026-11-09,
// issue #236): a team's Wrangler block may name the production gateway as its
// STRAVA_RETURN_VIA, so every local start of a team's app sets it again, to ""
// alone or to the local gateway behind it.

// `import.meta.glob` is declared in test/unit/dev-guard.test.ts.
const raw = (files: Record<string, string>) => Object.values(files)[0] ?? "";
const PACKAGE = raw(
	import.meta.glob("../../package.json", {
		query: "?raw",
		import: "default",
		eager: true,
	}),
);
const WRANGLER = raw(
	import.meta.glob("../../wrangler.jsonc", {
		query: "?raw",
		import: "default",
		eager: true,
	}),
);
const DEV = raw(
	import.meta.glob("../../scripts/dev.mjs", {
		query: "?raw",
		import: "default",
		eager: true,
	}),
);

const scripts = (JSON.parse(PACKAGE) as { scripts: Record<string, string> })
	.scripts;
const envs = (
	parseJsonc(WRANGLER) as {
		env: Record<string, { vars?: Record<string, string> }>;
	}
).env;

describe("local sign-ins and the production gateway", () => {
	it("reads the files", () => {
		expect(Object.keys(scripts).length).toBeGreaterThan(0);
		expect(Object.keys(envs).length).toBeGreaterThan(0);
		expect(DEV).toContain("export function devArgs");
	});

	it("names a gateway as return address only in production blocks", () => {
		for (const [name, block] of Object.entries(envs)) {
			const via = block.vars?.STRAVA_RETURN_VIA ?? "";
			if (name.startsWith("sandbox-")) expect(via, name).toBe("");
			else if (via !== "") expect(via, name).toMatch(/^https:\/\//);
		}
	});

	it("clears the return address in every package script that starts a team's app", () => {
		const starts = Object.entries(scripts).filter(
			([, command]) =>
				/\bwrangler dev\b/.test(command) &&
				!command.includes("gateway/wrangler.jsonc"),
		);
		expect(starts.map(([name]) => name)).toEqual(
			expect.arrayContaining(["dev:strava", "test:e2e:server"]),
		);
		for (const [name, command] of starts) {
			expect(command, name).toMatch(/--var STRAVA_RETURN_VIA:(\s|$)/);
		}
	});

	it("clears it in scripts/dev.mjs when a team runs without the local gateway", () => {
		expect(DEV).toMatch(
			/behindGateway\s*\?\s*behindGatewayArgs\(\)\s*:\s*\["--var",\s*"STRAVA_RETURN_VIA:"\]/,
		);
		expect(DEV).toMatch(/`STRAVA_RETURN_VIA:\$\{gateway\}`/);
	});
});
