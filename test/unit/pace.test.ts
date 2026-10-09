import { describe, expect, it } from "vitest";
import { evenPace, riderStatus } from "../../src/rynke/pace";
import {
	type CountingWindow,
	CURRENT_RULES,
	type RynkeRules,
} from "../../src/rynke/rules";
import { type Balance, NO_EXTRAS } from "../../src/rynke/tally";

// The even pace and the rider status behind the quote lists and the organiser
// groups (016 FR-030, FR-021, FR-032, research R4). Synthetic figures only.

const SEASON_START = "2026-01-01";
const DEADLINE = "2026-05-31"; // 150 days after the season start
const TODAY = "2026-03-25"; // 83 days after the season start

const WITH_DEADLINE: RynkeRules = {
	...CURRENT_RULES,
	qualificationDeadline: DEADLINE,
};
const RUNNING: CountingWindow = {
	seasonStart: SEASON_START,
	deadline: DEADLINE,
};

// The even pace on TODAY: ⌊250 × 83 ÷ 150⌋, ⌊25 × 83 ÷ 150⌋, ⌊167 × 83 ÷ 150⌋.
const PACE = { training: 138, team: 13, outdoor: 92 };

function balance(overrides: Partial<Balance> = {}): Balance {
	return {
		distanceRynke: 0,
		elevationDm: 0,
		elevationRynke: 0,
		elevationToNextStepDm: 10000,
		trainingRynke: PACE.training,
		teamRynke: PACE.team,
		trainingMissing: 250 - PACE.training,
		teamMissing: 25 - PACE.team,
		trainingWithoutVirtual: PACE.outdoor,
		virtualShareMissing: 167 - PACE.outdoor,
		qualified: false,
		rulesVersion: CURRENT_RULES.version,
		rulesEffectiveDate: CURRENT_RULES.effectiveDate,
		teamEvents: [...NO_EXTRAS.teamEvents],
		...overrides,
	};
}

describe("evenPace", () => {
	it("is 0 on the season start and the whole amount on the deadline", () => {
		expect(evenPace(250, SEASON_START, DEADLINE, SEASON_START)).toBe(0);
		expect(evenPace(250, SEASON_START, DEADLINE, DEADLINE)).toBe(250);
	});

	it("rounds down in between", () => {
		expect(evenPace(250, SEASON_START, DEADLINE, TODAY)).toBe(PACE.training);
		expect(evenPace(25, SEASON_START, DEADLINE, TODAY)).toBe(PACE.team);
		expect(evenPace(167, SEASON_START, DEADLINE, TODAY)).toBe(PACE.outdoor);
	});

	it("stays within 0 and the amount outside the season", () => {
		expect(evenPace(250, SEASON_START, DEADLINE, "2025-12-20")).toBe(0);
		expect(evenPace(250, SEASON_START, DEADLINE, "2026-06-10")).toBe(250);
	});

	it("counts whole days across a daylight-saving change", () => {
		// 2026-03-29 is the spring change in Berlin; 88 of 150 days.
		expect(evenPace(150, SEASON_START, DEADLINE, "2026-03-30")).toBe(88);
	});
});

describe("riderStatus", () => {
	it("is in for a rider who qualifies", () => {
		expect(
			riderStatus(
				balance({ qualified: true, trainingRynke: 0 }),
				WITH_DEADLINE,
				RUNNING,
				TODAY,
			),
		).toBe("in");
	});

	it("is on track at the even pace on every amount", () => {
		expect(riderStatus(balance(), WITH_DEADLINE, RUNNING, TODAY)).toBe(
			"on_track",
		);
	});

	it("is push when any one amount is below its even pace", () => {
		for (const behind of [
			{ trainingRynke: PACE.training - 1 },
			{ teamRynke: PACE.team - 1 },
			{ trainingWithoutVirtual: PACE.outdoor - 1 },
		]) {
			expect(riderStatus(balance(behind), WITH_DEADLINE, RUNNING, TODAY)).toBe(
				"push",
			);
		}
	});

	it("follows qualification only without a deadline", () => {
		const open: CountingWindow = { seasonStart: SEASON_START, deadline: null };
		expect(
			riderStatus(balance({ trainingRynke: 249 }), CURRENT_RULES, open, TODAY),
		).toBe("push");
		expect(
			riderStatus(balance({ qualified: true }), CURRENT_RULES, open, TODAY),
		).toBe("in");
	});

	it("follows qualification only once the deadline has passed", () => {
		expect(riderStatus(balance(), WITH_DEADLINE, RUNNING, "2026-06-01")).toBe(
			"push",
		);
	});

	it("is push for a rider without a balance", () => {
		expect(riderStatus(null, WITH_DEADLINE, RUNNING, TODAY)).toBe("push");
	});
});
