import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../scripts/team-check.mjs";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";
import type { CloudflarePart } from "../../src/usage/cloudflare";
import {
	GATEWAY_WORKER,
	isSplit,
	ownerOf,
	SHARED,
	splitDay,
} from "../../src/usage/split";

// Cloudflare's figures split by team (feature 026 FR-040), as pure logic.

const DAY = "2026-11-04";
const teams = [hamburg, europe];

// `import.meta.glob` is declared in test/unit/dev-guard.test.ts.
const GATEWAY = import.meta.glob("../../gateway/wrangler.jsonc", {
	query: "?raw",
	import: "default",
	eager: true,
});

const part = (
	allowance: CloudflarePart["allowance"],
	kind: CloudflarePart["kind"],
	id: string,
	value: number,
	day = DAY,
): CloudflarePart => ({ day, allowance, kind, id, value });

describe("ownerOf", () => {
	it("finds a team by its Worker and its database", () => {
		expect(ownerOf("worker", "rynke-points", teams)).toBe("hamburg");
		expect(ownerOf("worker", "rynke-points-europe", teams)).toBe("europe");
		expect(ownerOf("database", hamburg.cloudflare.databaseId, teams)).toBe(
			"hamburg",
		);
	});

	it("counts the gateway as shared, and anything else as nobody's", () => {
		expect(ownerOf("worker", GATEWAY_WORKER, teams)).toBe(SHARED);
		expect(ownerOf("worker", "some-sandbox", teams)).toBeNull();
	});

	it("knows the gateway by the name it deploys with", () => {
		const config = parseJsonc(Object.values(GATEWAY)[0] ?? "") as {
			name: string;
		};
		expect(config.name).toBe(GATEWAY_WORKER);
	});
});

describe("splitDay", () => {
	const parts = [
		part("cf_worker_requests", "worker", "rynke-points", 600),
		part("cf_worker_requests", "worker", "rynke-points-europe", 300),
		part("cf_worker_requests", "worker", GATEWAY_WORKER, 50),
		part("cf_worker_requests", "worker", "some-sandbox", 50),
		part("cf_worker_requests", "worker", "rynke-points", 999, "2026-11-03"),
		part("cf_queue_operations", "queue", "queue-0", 80),
	];

	it("gives every team and the shared part their values, zero for none", () => {
		const split = splitDay(parts, DAY, teams, hamburg);
		expect(Object.fromEntries(split.get("cf_worker_requests") ?? [])).toEqual({
			hamburg: 600,
			europe: 300,
			[SHARED]: 50,
		});
		expect(Object.fromEntries(split.get("cf_d1_rows_read") ?? [])).toEqual({
			hamburg: 0,
			europe: 0,
			[SHARED]: 0,
		});
	});

	it("leaves queue operations unsplit while the team's queue IDs aren't known", () => {
		expect(isSplit("cf_queue_operations", hamburg.cloudflare)).toBe(false);
		expect(
			splitDay(parts, DAY, teams, hamburg).has("cf_queue_operations"),
		).toBe(false);
		const known = {
			...hamburg,
			cloudflare: { ...hamburg.cloudflare, queueIds: ["queue-0"] },
		};
		const split = splitDay(parts, DAY, [known, europe], known);
		expect(split.get("cf_queue_operations")?.get("hamburg")).toBe(80);
	});
});
