import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../scripts/team-check.mjs";

// Feature 046 FR-017, FR-018, research R1, R2: routing ships as the trial,
// which still sends every event to every team, and in the EU; local development runs the local gateway with routing and its
// own copy.

// `import.meta.glob` is declared in test/unit/dev-guard.test.ts.
const raw = (files: Record<string, string>) => Object.values(files)[0] ?? "";
const GATEWAY = raw(
	import.meta.glob("../../gateway/wrangler.jsonc", {
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

const config = parseJsonc(GATEWAY) as {
	vars: Record<string, string>;
	durable_objects: { bindings: { name: string; class_name: string }[] };
	migrations: { new_sqlite_classes?: string[] }[];
};

describe("the gateway's routing settings", () => {
	it("ship the trial, never routing itself", () => {
		expect(config.vars.ROUTING).toBe("trial");
	});

	it("never let production skip the EU jurisdiction", () => {
		expect(config.vars).not.toHaveProperty("ROUTING_COPY_LOCAL");
	});

	it("declare the copy as a SQLite Durable Object", () => {
		expect(config.durable_objects.bindings).toEqual([
			{ name: "ROUTING_COPY", class_name: "RoutingCopy" },
		]);
		expect(config.migrations.flatMap((m) => m.new_sqlite_classes)).toContain(
			"RoutingCopy",
		);
	});
});

describe("pnpm dev's gateway", () => {
	it("routes, with its own local copy", () => {
		expect(DEV).toContain('"ROUTING:on"');
		expect(DEV).toContain('"ROUTING_COPY_LOCAL:local-only"');
	});
});
