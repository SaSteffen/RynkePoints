import { describe, expect, it } from "vitest";
import type { TeamRider } from "../../src/db/team";
import {
	overviewBody,
	overviewRiders,
	parseGroup,
} from "../../src/http/organiser/overview";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { riderStatus } from "../../src/rynke/pace";
import { type CountingWindow, CURRENT_RULES } from "../../src/rynke/rules";
import type { Balance } from "../../src/rynke/tally";

// The organiser overview's figures and groups (016 US4, FR-030–FR-035,
// data-model.md `OverviewRider`), from a hand-made read. Synthetic riders only.

const en = createI18n("en", CATALOGS);
const de = createI18n("de", CATALOGS);

const RUNNING: CountingWindow = {
	seasonStart: "2026-01-01",
	deadline: "2026-05-31", // 150 days after the season start
};
const TODAY = "2026-03-25"; // 83 days after the season start, 67 to go
const AFTER = "2026-06-01";

// The even pace on TODAY: ⌊250 × 83 ÷ 150⌋, ⌊25 × 83 ÷ 150⌋, ⌊167 × 83 ÷ 150⌋.
const PACE = { training: 138, team: 13, outdoor: 92 };

function balance(training: number, team: number, outdoor: number): Balance {
	const trainingMissing = Math.max(0, 250 - training);
	const teamMissing = Math.max(0, 25 - team);
	const virtualShareMissing = Math.max(0, 167 - outdoor);
	return {
		distanceRynke: training - 20,
		elevationDm: 30000,
		elevationRynke: 15,
		elevationToNextStepDm: 10000,
		trainingRynke: training,
		teamRynke: team,
		trainingMissing,
		teamMissing,
		trainingWithoutVirtual: outdoor,
		virtualShareMissing,
		qualified:
			trainingMissing === 0 && teamMissing === 0 && virtualShareMissing === 0,
		rulesVersion: CURRENT_RULES.version,
		rulesEffectiveDate: CURRENT_RULES.effectiveDate,
		teamEvents: [
			{ kind: "team_training", attended: 2, team: 2, training: 10 },
			{ kind: "training_weekend_day", attended: 0, team: 0, training: 0 },
			{ kind: "technique_training", attended: 0, team: 0, training: 0 },
		],
	};
}

function rider(
	athleteId: number,
	firstName: string,
	b: Balance | null,
	corrections: TeamRider["corrections"] = [],
): TeamRider {
	return {
		athleteId,
		firstName,
		balance: b && { ...b, computedAt: 0 },
		rides: [],
		attendance: [],
		corrections,
	};
}

const QUALIFIED = rider(1, "Paula", balance(300, 30, 250));
const ON_TRACK = rider(2, "Jonas", balance(200, 20, 150));
const BEHIND = rider(3, "Jonas", balance(100, 20, 100), [
	{ date: "2026-02-01", training: 10, team: 0 },
	{ date: "2026-03-01", training: -4, team: 2 },
]);
const NO_BALANCE = rider(4, "Mira", null);
const READ = [QUALIFIED, ON_TRACK, BEHIND, NO_BALANCE];

describe("overviewRiders", () => {
	const riders = overviewRiders(READ, CURRENT_RULES, RUNNING, TODAY);
	const byId = (id: number) => riders.find((r) => r.athleteId === id);

	it("gives each rider riderStatus's group", () => {
		for (const r of READ) {
			expect(byId(r.athleteId)?.status).toBe(
				riderStatus(r.balance, CURRENT_RULES, RUNNING, TODAY),
			);
		}
		expect(riders.map((r) => [r.athleteId, r.status])).toContainEqual([
			1,
			"in",
		]);
		expect(byId(2)?.status).toBe("on_track");
		expect(byId(3)?.status).toBe("push");
		expect(byId(4)?.status).toBe("push");
	});

	it("puts the ones missing the most first", () => {
		expect(riders.map((r) => r.athleteId)).toEqual([4, 3, 2, 1]);
	});

	it("takes the figures and missing amounts from the stored balance", () => {
		expect(byId(3)).toMatchObject({
			firstName: "Jonas",
			training: 100,
			team: 20,
			outdoorTraining: 100,
			pace: PACE,
			missing: {
				training: { amount: 150, behind: true },
				team: { amount: 5, behind: false },
				outdoor: { amount: 67, behind: false },
			},
		});
		expect(byId(1)?.missing).toEqual({
			training: { amount: 0, behind: false },
			team: { amount: 0, behind: false },
			outdoor: { amount: 0, behind: false },
		});
		expect(byId(4)).toMatchObject({
			training: 0,
			missing: {
				training: { amount: 250, behind: true },
				team: { amount: 25, behind: true },
				outdoor: { amount: 167, behind: true },
			},
		});
	});

	it("holds the breakdown, with corrections summed from the read", () => {
		expect(byId(3)?.breakdown).toEqual({
			distanceRynke: 80,
			elevationRynke: 15,
			teamEvents: BEHIND.balance?.teamEvents,
			corrections: { training: 6, team: 2 },
			virtualShare: 0,
		});
		// 300 Training, 250 of them outdoors: 50 virtual, 17 %.
		expect(byId(1)?.breakdown.virtualShare).toBe(17);
		expect(byId(4)?.breakdown).toMatchObject({
			distanceRynke: 0,
			teamEvents: [],
			virtualShare: 0,
		});
	});

	it("links the profile only for a shared first name (014 withProfileLinks)", () => {
		expect(byId(2)?.profileLink).toBe("https://www.strava.com/athletes/2");
		expect(byId(3)?.profileLink).toBe("https://www.strava.com/athletes/3");
		expect(byId(1)?.profileLink).toBeNull();
	});

	it("has no even pace and no one on track once the deadline has passed", () => {
		const after = overviewRiders(READ, CURRENT_RULES, RUNNING, AFTER);
		expect(after.every((r) => r.pace === null)).toBe(true);
		expect(after.map((r) => r.status).sort()).toEqual([
			"in",
			"push",
			"push",
			"push",
		]);
		expect(after.flatMap((r) => Object.values(r.missing))).not.toContainEqual(
			expect.objectContaining({ behind: true }),
		);
	});
});

describe("parseGroup", () => {
	it.each([
		["push", false, "push"],
		["on_track", false, "on_track"],
		["in", false, "in"],
		["all", false, "all"],
		["on_track", true, "all"],
		[null, false, null],
		["everyone", false, null],
	] as const)("reads %j (passed %j) as %j", (value, passed, group) => {
		expect(parseGroup(value, passed)).toBe(group);
	});
});

describe("overviewBody", () => {
	const page = (
		group: Parameters<typeof overviewBody>[4],
		today = TODAY,
		i18n = en,
	) => overviewBody(READ, CURRENT_RULES, RUNNING, today, group, i18n).value;
	const tiles = (html: string) =>
		[
			...html.matchAll(
				/<a class="group-tile tile-(\w+)"[^>]*>(?:(?!<\/a>)[\s\S])*?<span class="tile-count">(\d+)<\/span><span class="tile-label">([^<]*)<\/span><\/a>/g,
			),
		].map((m) => [m[1], m[2], m[3]]);
	const cards = (html: string) =>
		[...html.matchAll(/<li class="rider-card status-(\w+)">/g)].map(
			(m) => m[1],
		);

	it("shows the deadline with the days to go and who qualifies (FR-031)", () => {
		const html = page(null);
		expect(html).toContain("Qualification deadline · 31/05/2026");
		expect(html).toContain("67 days to go ⏳");
		expect(html).toContain("1 of 4 reached their training goal 🎯");
		expect(page(null, TODAY, de)).toContain("Noch 67 Tage ⏳");
	});

	it("has a tile per group with its count (FR-032)", () => {
		expect(tiles(page(null))).toEqual([
			["push", "2", "Need a push 🍌"],
			["on_track", "1", "On track 🚴"],
			["in", "1", "Training goal reached 🎯"],
			["all", "4", "Everyone"],
		]);
	});

	it("renders every rider without a group, phone first on Need a push (research R9)", () => {
		const html = page(null);
		expect(cards(html)).toEqual(["push", "push", "on_track", "in"]);
		expect(html).toContain('<ul class="rider-cards default">');
		expect(html).toContain('<nav class="group-tiles default"');
		expect(html).not.toContain('aria-current="true"');
		expect(html).toContain(
			'<p class="visually-hidden showing-phone">Showing: Need a push 🍌</p>',
		);
		expect(html).toContain(
			'<p class="visually-hidden showing-wide">Showing: Everyone</p>',
		);
	});

	it("renders only the picked group and marks its tile", () => {
		const html = page("on_track");
		expect(cards(html)).toEqual(["on_track"]);
		expect(html.match(/<tr class="status-/g)).toHaveLength(1);
		expect(html).toMatch(
			/<a class="group-tile tile-on_track" href="\/organiser\/riders\?group=on_track" aria-current="true">/,
		);
		expect(html).not.toContain("showing-phone");
	});

	it("marks the even pace on the bars and names it in the hint (FR-033, FR-041)", () => {
		const html = page(null);
		expect(html).toContain("today 138 Training and 13 Team.");
		expect(html.match(/<line class="pace-mark"/g)).toHaveLength(
			// Training and Team, in a card and a table row, for four riders.
			2 * 2 * 4,
		);
		expect(html).toMatch(/<svg class="threshold-bar"[^>]*aria-hidden="true"/);
	});

	it("names the missing amounts and marks the ones behind pace (FR-033)", () => {
		const html = page("push");
		expect(html).toContain(
			'<li class="behind">150 Training to go · behind pace</li>',
		);
		expect(html).toContain("<li>5 Team to go</li>");
		expect(html).toContain("<li>67 outdoor Training to go</li>");
	});

	it("folds the breakdown into each card (FR-033, FR-035)", () => {
		const html = page("push");
		expect(html).toContain(
			'<details class="rider-breakdown"><summary class="tap">Where the Rynke come from</summary>',
		);
		expect(html).toContain("<li>Distance 80</li>");
		expect(html).toContain("<li>Elevation 15</li>");
		expect(html).toContain("<li>Team training: 2× → 10 Training, 2 Team</li>");
		expect(html).toContain("<li>Corrections 6 Training, 2 Team</li>");
		expect(html).toContain("<li>Outdoor Training 100 of 167</li>");
		expect(html).toContain("<li>Virtual rides 0 % of Training</li>");
	});

	it("lists who qualified (FR-034)", () => {
		const html = page("push");
		const qualified = html.slice(html.indexOf('<section class="qualified">'));
		expect(qualified).toContain("Paula");
		expect(qualified).not.toContain("Jonas");
	});

	it("says the deadline has passed and drops On track after it (spec edge cases)", () => {
		const html = page(null, AFTER);
		expect(html).toContain("The deadline has passed");
		expect(html).not.toContain("days to go");
		expect(tiles(html).map(([group, , label]) => [group, label])).toEqual([
			["push", "Training goal not reached yet"],
			["in", "Training goal reached 🎯"],
			["all", "Everyone"],
		]);
		expect(html).not.toContain("pace-mark");
		expect(html).not.toContain("The tick on each bar");
	});

	it("says nobody qualifies yet, and nobody is listed", () => {
		const nobody = overviewBody(
			[ON_TRACK, BEHIND],
			CURRENT_RULES,
			RUNNING,
			TODAY,
			null,
			en,
		).value;
		expect(nobody).toContain("Nobody has reached the training goal yet.");
		const none = overviewBody(
			[],
			CURRENT_RULES,
			RUNNING,
			TODAY,
			null,
			en,
		).value;
		expect(none).toContain("No riders share their Rynke yet.");
		expect(none).not.toContain("rider-cards");
	});
});
