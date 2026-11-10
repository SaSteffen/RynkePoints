import { describe, expect, it } from "vitest";
import {
	SANDBOX_DAILY_BUDGET,
	SANDBOX_USAGE_THRESHOLD,
	sandboxUsageVerdict,
} from "../../dev/sandbox-usage";
import type { CloudflareAllowance } from "../../src/usage/allowances";
import type {
	CloudflarePart,
	CloudflareResult,
} from "../../src/usage/cloudflare";

// The usage check before a sandbox deployment writes anything (feature 027
// contracts/sandbox-workflow.md "Usage check", FR-033, FR-034): a pure verdict
// over Cloudflare's figures for the account, the seed's rows and the sandbox
// databases' own rows written today.

const TODAY = "2026-11-10";
const YESTERDAY = "2026-11-09";
const SANDBOXES = ["sandbox-db-hamburg", "sandbox-db-europe"];

type Figures = Partial<Record<CloudflareAllowance, number>>;

function ok(today: Figures, parts: CloudflarePart[] = []): CloudflareResult {
	return {
		kind: "ok",
		today: TODAY,
		yesterday: YESTERDAY,
		days: new Map([
			[YESTERDAY, { cf_d1_rows_written: 99_000, cf_d1_rows_read: 4_900_000 }],
			[TODAY, today],
		]),
		parts,
	};
}

const written = (id: string, value: number, day = TODAY): CloudflarePart => ({
	day,
	allowance: "cf_d1_rows_written",
	kind: "database",
	id,
	value,
});

describe("sandboxUsageVerdict", () => {
	it("uses half of each allowance and a budget of 40,000 rows", () => {
		expect(SANDBOX_USAGE_THRESHOLD).toBe(0.5);
		expect(SANDBOX_DAILY_BUDGET).toBe(40_000);
	});

	it("stops when Cloudflare's figures are unavailable", () => {
		const verdict = sandboxUsageVerdict(
			{ kind: "unavailable", reason: "not configured" },
			100,
			SANDBOXES,
		);
		expect(verdict).toEqual({
			go: false,
			lines: ["Cloudflare's figures are unavailable (not configured)"],
		});
	});

	it("stops when rows written plus the seed pass half the allowance", () => {
		const verdict = sandboxUsageVerdict(
			ok({ cf_d1_rows_written: 49_000 }),
			1_001,
			SANDBOXES,
		);
		expect(verdict.go).toBe(false);
		expect(verdict.lines).toContain(
			"D1 rows written with the seed at 50001 of 100000 today, above 50 %",
		);
	});

	it("stops when rows read pass half the allowance", () => {
		const verdict = sandboxUsageVerdict(
			ok({ cf_d1_rows_read: 2_500_001 }),
			0,
			SANDBOXES,
		);
		expect(verdict.go).toBe(false);
		expect(verdict.lines).toContain(
			"D1 rows read at 2500001 of 5000000 today, above 50 %",
		);
	});

	it("stops when queue operations pass half the allowance", () => {
		const verdict = sandboxUsageVerdict(
			ok({ cf_queue_operations: 5_001 }),
			0,
			SANDBOXES,
		);
		expect(verdict.go).toBe(false);
		expect(verdict.lines).toContain(
			"Queue operations at 5001 of 10000 today, above 50 %",
		);
	});

	it("stops when the sandboxes' rows today plus the seed pass the budget", () => {
		const verdict = sandboxUsageVerdict(
			ok({ cf_d1_rows_written: 30_000 }, [
				written("sandbox-db-hamburg", 20_000),
				written("sandbox-db-europe", 15_000),
				written("production-db", 9_000),
				written("sandbox-db-hamburg", 30_000, YESTERDAY),
			]),
			5_001,
			SANDBOXES,
		);
		expect(verdict.go).toBe(false);
		expect(verdict.lines).toContain(
			"Sandbox databases' rows written with the seed at 40001 of 40000 today, above the budget",
		);
	});

	it("goes exactly at each limit", () => {
		const verdict = sandboxUsageVerdict(
			ok(
				{
					cf_d1_rows_written: 30_000,
					cf_d1_rows_read: 2_500_000,
					cf_queue_operations: 5_000,
				},
				[written("sandbox-db-hamburg", 20_000)],
			),
			20_000,
			SANDBOXES,
		);
		expect(verdict.go).toBe(true);
	});

	it("goes when well below, listing each figure", () => {
		const verdict = sandboxUsageVerdict(
			ok({ cf_d1_rows_written: 1_000, cf_d1_rows_read: 20_000 }, [
				written("sandbox-db-europe", 300),
			]),
			200,
			SANDBOXES,
		);
		expect(verdict).toEqual({
			go: true,
			lines: [
				"D1 rows written with the seed at 1200 of 100000 today",
				"D1 rows read at 20000 of 5000000 today",
				"Queue operations at 0 of 10000 today",
				"Sandbox databases' rows written with the seed at 500 of 40000 today",
			],
		});
	});

	it("reads a day without figures yet as zero", () => {
		const result = ok({});
		if (result.kind === "ok") result.days.delete(TODAY);
		expect(sandboxUsageVerdict(result, 0, SANDBOXES).go).toBe(true);
	});

	it("lists every figure above its limit, not just the first", () => {
		const verdict = sandboxUsageVerdict(
			ok({ cf_d1_rows_read: 3_000_000, cf_queue_operations: 6_000 }),
			0,
			SANDBOXES,
		);
		expect(verdict.go).toBe(false);
		expect(verdict.lines.filter((line) => line.endsWith("above 50 %"))).toEqual(
			[
				"D1 rows read at 3000000 of 5000000 today, above 50 %",
				"Queue operations at 6000 of 10000 today, above 50 %",
			],
		);
	});
});
