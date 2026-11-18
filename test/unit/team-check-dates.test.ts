import { describe, expect, it } from "vitest";
import { parseJsonc, seasonDateProblems } from "../../scripts/team-check.mjs";

// `import.meta.glob` is declared in test/unit/dev-guard.test.ts.
const FILES = import.meta.glob("../../wrangler.jsonc", {
	query: "?raw",
	import: "default",
	eager: true,
});

// The season and the qualification window (feature 040 FR-001, FR-003): every
// season starts on 1 September and ends the day before the next; the window
// opens on or after the season start and closes on or before the season end.

const good = {
	SEASON_START_DATE: "2026-09-01",
	QUALIFICATION_START_DATE: "2027-01-01",
	QUALIFICATION_DEADLINE: "2027-06-30",
};

describe("seasonDateProblems", () => {
	it("accepts a window inside the season", () => {
		expect(seasonDateProblems(good)).toEqual([]);
	});

	it("accepts a window opening on the season start", () => {
		expect(
			seasonDateProblems({ ...good, QUALIFICATION_START_DATE: "2026-09-01" }),
		).toEqual([]);
	});

	it("accepts a deadline on the season end", () => {
		expect(
			seasonDateProblems({ ...good, QUALIFICATION_DEADLINE: "2027-08-31" }),
		).toEqual([]);
	});

	it("refuses a season start that isn't a 1 September", () => {
		expect(
			seasonDateProblems({ ...good, SEASON_START_DATE: "2027-01-01" }),
		).toEqual(['SEASON_START_DATE: "2027-01-01", not a 1 September']);
	});

	it("refuses a window start before the season start", () => {
		expect(
			seasonDateProblems({ ...good, QUALIFICATION_START_DATE: "2026-08-31" }),
		).toEqual([
			'QUALIFICATION_START_DATE: "2026-08-31", before SEASON_START_DATE "2026-09-01"',
		]);
	});

	it("refuses a window start after the deadline", () => {
		expect(
			seasonDateProblems({ ...good, QUALIFICATION_START_DATE: "2027-07-01" }),
		).toEqual([
			'QUALIFICATION_START_DATE: "2027-07-01", after QUALIFICATION_DEADLINE "2027-06-30"',
		]);
	});

	it("refuses a deadline after the season end", () => {
		expect(
			seasonDateProblems({ ...good, QUALIFICATION_DEADLINE: "2027-09-01" }),
		).toEqual([
			'QUALIFICATION_DEADLINE: "2027-09-01", after the season end "2027-08-31"',
		]);
	});

	it("refuses a date that isn't one", () => {
		expect(
			seasonDateProblems({ ...good, QUALIFICATION_START_DATE: "2027-02-30" }),
		).toEqual(['QUALIFICATION_START_DATE: "2027-02-30", not a date']);
	});

	it("leaves a missing var to the missing-var check", () => {
		const { QUALIFICATION_START_DATE: _, ...rest } = good;
		expect(seasonDateProblems(rest)).toEqual([]);
	});

	it("accepts every block in wrangler.jsonc", () => {
		const wrangler = parseJsonc(Object.values(FILES)[0] ?? "") as {
			env: Record<string, { vars: Record<string, string> }>;
		};
		for (const [name, block] of Object.entries(wrangler.env)) {
			expect(seasonDateProblems(block.vars), name).toEqual([]);
		}
	});
});
