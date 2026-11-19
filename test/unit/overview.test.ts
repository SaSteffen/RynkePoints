import { describe, expect, it } from "vitest";
import type { TeamRider } from "../../src/db/team";
import { artUrl } from "../../src/http/art";
import {
	overviewBody,
	overviewPace,
	overviewRiders,
	parseGroup,
	percentOf,
} from "../../src/http/organiser/overview";

import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { riderStatus } from "../../src/rynke/pace";
import type { CountingWindow, RynkeRules } from "../../src/rynke/rules";
import type { Balance } from "../../src/rynke/tally";
import { hamburg } from "../../src/teams/hamburg";
import { CURRENT_RULES } from "../support/team-rules";

// The organiser overview's figures and groups (016 US4, FR-030–FR-035,
// data-model.md `OverviewRider`), from a hand-made read. Synthetic riders only.

const en = createI18n("en", CATALOGS);
const de = createI18n("de", CATALOGS);

const RUNNING: CountingWindow = {
	seasonStart: "2026-01-01",
	windowStart: "2026-01-01",
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

	// Review L-02: the same corrections as the balance counts.
	it("sums only the corrections dated inside the window", () => {
		const read = [
			rider(5, "Lena", balance(100, 20, 100), [
				{ date: "2025-12-31", training: 40, team: 5 },
				{ date: "2026-01-01", training: 10, team: 0 },
				{ date: "2026-05-31", training: 0, team: 2 },
				{ date: "2026-06-01", training: 40, team: 5 },
			]),
		];
		expect(
			overviewRiders(read, CURRENT_RULES, RUNNING, TODAY)[0]?.breakdown
				.corrections,
		).toEqual({ training: 10, team: 2 });
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
	) =>
		overviewBody(READ, CURRENT_RULES, RUNNING, today, group, i18n, hamburg)
			.value;
	const tiles = (html: string) =>
		[
			...html.matchAll(
				/<a class="group-tile tile-(\w+)"[^>]*>(?:(?!<\/a>)[\s\S])*?<span class="tile-count">(\d+)<\/span><span class="tile-label">([^<]*)<\/span>(?:<img [^>]*>)?<\/a>/g,
			),
		].map((m) => [m[1], m[2], m[3]]);
	const cards = (html: string) =>
		[
			...html.matchAll(
				/<li class="rider-row status-(\w+)" data-name="[^"]*">/g,
			),
		].map((m) => m[1]);

	it("shows the deadline with the days to go and who qualifies (FR-031)", () => {
		const html = page(null);
		expect(html).toContain("Qualification deadline · 31/05/2026");
		expect(html).toContain("67 days to go ⏳");
		expect(html).toContain("1 of 4 reached their training goal 🎯");
		expect(page(null, TODAY, de)).toContain("Noch 67 Tage ⏳");
	});

	it("has a tile per group with its count (FR-032)", () => {
		expect(tiles(page(null))).toEqual([
			["requests", "0", "Riders with an open report"],
			["push", "2", "Need a push"],
			["on_track", "1", "On track"],
			["in", "1", "Training goal reached"],
			["all", "4", "Everyone"],
		]);
	});

	it("puts Rynke on a bike on each group's tile and chip (issue #93)", () => {
		const html = page(null);
		const tile = (group: string) =>
			html.match(
				new RegExp(`<a class="group-tile tile-${group}"[\\s\\S]*?</a>`),
			)?.[0];
		for (const status of ["push", "on_track", "in"]) {
			expect(tile(status)).toContain(
				`<img class="status-art status-art-tile" src="${artUrl(`/illustrations/status_${status}_fun.svg`)}" alt="" width="96" height="96">`,
			);
		}
		expect(tile("all")).not.toContain("<img");
		expect(tile("requests")).not.toContain("<img");
		expect(html).toContain(
			`<span class="status-chip"><img class="status-art status-art-chip" src="${artUrl("/illustrations/status_on_track_fun.svg")}" alt="" width="20" height="20">On track</span>`,
		);
	});

	it("renders every rider without a group, phone first on Need a push (research R9)", () => {
		const html = page(null);
		expect(cards(html)).toEqual(["push", "push", "on_track", "in"]);
		expect(html).toContain('<ul class="rider-rows default">');
		expect(html).toContain('<nav class="group-tiles default"');
		expect(html).not.toContain('aria-current="true"');
		expect(html).toContain(
			'<p class="visually-hidden showing-phone">Showing: Need a push</p>',
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
			/<a class="group-tile tile-on_track" href="\/organiser\/riders\?group=on_track" data-swap aria-current="true">/,
		);
		expect(html).not.toContain("showing-phone");
	});

	it("marks the even pace on the bars and names it in the hint (FR-033, FR-041)", () => {
		const html = page(null);
		expect(html).toContain("today 138 Training and 13 Team.");
		expect(html.match(/<line class="pace-mark"/g)).toHaveLength(
			// Training and Team in a row's line, its body and the table, for four.
			(2 + 2 + 2) * 4,
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
			["requests", "Riders with an open report"],
			["push", "Training goal not reached yet"],
			["in", "Training goal reached"],
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
			hamburg,
		).value;
		expect(nobody).toContain("Nobody has reached the training goal yet.");
		const none = overviewBody(
			[],
			CURRENT_RULES,
			RUNNING,
			TODAY,
			null,
			en,
			hamburg,
		).value;
		expect(none).toContain("No riders share their Rynke yet.");
		expect(none).not.toContain("rider-rows");
	});
});

describe("percentOf", () => {
	it.each([
		[0, 250, 0],
		[100, 250, 40],
		[249, 250, 99],
		[250, 250, 100],
		[300, 250, 100],
		[-5, 25, 0],
	])("gives %j of %j as %j %%", (value, threshold, percent) => {
		expect(percentOf(value, threshold)).toBe(percent);
	});
});

describe("overviewBody with ORGANISER_FIGURES percent", () => {
	const page = (i18n = en) =>
		overviewBody(
			READ,
			CURRENT_RULES,
			RUNNING,
			TODAY,
			"all",
			i18n,
			hamburg,
			new Map(),
			false,
			"percent",
		).value;
	/** The card of the rider called `name`; the cards end at the table. */
	function cardOf(html: string, name: string): string {
		const start = html.indexOf('<ul class="rider-rows');
		const cards = html.slice(start, html.indexOf('<div class="table-scroll"'));
		const all = cards.split('<li class="rider-row');
		return all.find((card) => card.includes(`>${name}</span>`)) ?? "";
	}

	it("gives Training and Team in percent, up to 100 %, without amounts", () => {
		const html = page();
		expect(cardOf(html, "Paula")).toContain("Training 100%");
		expect(cardOf(html, "Paula")).toContain("Team 100%");
		expect(cardOf(html, "Mira")).toContain("Team 0%");
		expect(html).toContain("Training 80%");
		expect(html).toContain("Training 40%");
		expect(html).not.toContain("of 250");
		expect(html).not.toContain("Training to go");
		expect(html).not.toContain("Team to go");
		expect(page(de)).toContain("Training 40 %");
	});

	it("names the reasons without amounts, outdoor Training among them", () => {
		const html = page();
		expect(cardOf(html, "Mira")).toContain("Training behind pace");
		expect(cardOf(html, "Mira")).toContain("Not enough outdoor Training yet");
		expect(cardOf(html, "Paula")).not.toContain("rider-missing");
	});

	it("keeps only the corrections, as amounts, of where the Rynke come from", () => {
		const html = page();
		expect(html).not.toContain("rider-breakdown");
		expect(html).not.toContain("Virtual rides");
		expect(html).toContain("Corrections 6 Training, 2 Team");
	});

	it("gives the even pace in percent", () => {
		// 138 of 250 and 13 of 25 (PACE), rounded down.
		expect(page()).toContain("today 55% of Training and 52% of Team.");
	});

	it("drops the table's virtual, distance and elevation columns", () => {
		const head = page().match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";
		expect(head).toContain("Corrections");
		expect(head).not.toContain("Virtual");
		expect(head).not.toContain("Distance");
		expect(head).not.toContain("Elevation");
	});
});

// A team without Team Rynke and events (feature 039 US4): the Team part is
// absent from the figures and the page, not zero.
describe("the overview without Team Rynke", () => {
	const NO_TEAM: RynkeRules = {
		...CURRENT_RULES,
		teamThreshold: null,
		teamEvents: Object.fromEntries(
			Object.entries(CURRENT_RULES.teamEvents).map(([kind, amounts]) => [
				kind,
				{ ...amounts, team: 0 },
			]),
		) as RynkeRules["teamEvents"],
	};
	const WITHOUT_EVENTS = { eventKinds: [], art: hamburg.art } as const;

	/** What the evaluation stores without Team Rynke: nothing missing of Team. */
	function noTeamBalance(training: number, outdoor: number): Balance {
		const trainingMissing = Math.max(0, 250 - training);
		const virtualShareMissing = Math.max(0, 167 - outdoor);
		return {
			...balance(training, 0, outdoor),
			trainingMissing,
			teamMissing: 0,
			virtualShareMissing,
			qualified: trainingMissing === 0 && virtualShareMissing === 0,
		};
	}

	const PAULA = rider(1, "Paula", noTeamBalance(300, 250));
	const JONAS = rider(2, "Jonas", noTeamBalance(150, 100), [
		{ date: "2026-02-01", training: 10, team: 0 },
		{ date: "2026-03-01", training: -4, team: 0 },
	]);
	const MIRA = rider(3, "Mira", null);
	const READ_NO_TEAM = [PAULA, JONAS, MIRA];

	describe("overviewRiders", () => {
		const riders = overviewRiders(READ_NO_TEAM, NO_TEAM, RUNNING, TODAY);
		const byId = (id: number) => riders.find((r) => r.athleteId === id);

		it("leaves out each rider's Team amount, missing, pace and events", () => {
			for (const r of riders) {
				expect(r.team).toBeNull();
				expect(r.missing.team).toBeNull();
				expect(r.pace?.team).toBeNull();
				expect(r.breakdown.teamEvents).toEqual([]);
			}
			expect(overviewPace(NO_TEAM, RUNNING, TODAY)).toEqual({
				training: PACE.training,
				team: null,
				outdoor: PACE.outdoor,
			});
		});

		it("keeps Training and outdoor Training as they are", () => {
			expect(byId(2)).toMatchObject({
				training: 150,
				outdoorTraining: 100,
				missing: {
					training: { amount: 100, behind: false },
					outdoor: { amount: 67, behind: false },
				},
			});
			expect(byId(2)?.breakdown.corrections).toEqual({ training: 6, team: 0 });
			expect(byId(3)?.missing).toMatchObject({
				training: { amount: 250, behind: true },
				outdoor: { amount: 167, behind: true },
			});
		});

		it("groups and orders by Training and outdoor Training alone", () => {
			// Jonas is above both even paces; with Team Rynke 0 would be behind.
			expect(byId(2)?.status).toBe("on_track");
			expect(
				overviewRiders(READ_NO_TEAM, CURRENT_RULES, RUNNING, TODAY).find(
					(r) => r.athleteId === 2,
				)?.status,
			).toBe("push");
			expect(byId(1)?.status).toBe("in");
			expect(riders.map((r) => r.athleteId)).toEqual([3, 2, 1]);
		});

		it("is the founding team's with Team Rynke", () => {
			const founding = overviewRiders(READ, CURRENT_RULES, RUNNING, TODAY);
			for (const r of founding) {
				expect(typeof r.team).toBe("number");
				expect(r.missing.team).not.toBeNull();
				expect(typeof r.pace?.team).toBe("number");
			}
		});
	});

	describe.each([
		["full", "full"],
		["percent", "percent"],
	] as const)("overviewBody in %s figures", (_name, figures) => {
		const page = (group: Parameters<typeof overviewBody>[4] = "all") =>
			overviewBody(
				READ_NO_TEAM,
				NO_TEAM,
				RUNNING,
				TODAY,
				group,
				en,
				WITHOUT_EVENTS,
				new Map(),
				false,
				figures,
				null,
				"riders",
				null,
			).value;
		const founding = () =>
			overviewBody(
				READ,
				CURRENT_RULES,
				RUNNING,
				TODAY,
				"all",
				en,
				hamburg,
				new Map(),
				false,
				figures,
			).value;

		it("has no Team bar, figure, missing amount or breakdown line", () => {
			const html = page();
			for (const part of [
				"amount-team",
				"bar-team",
				"Team to go",
				"Team behind pace",
				"Team training",
				"Technique training",
				"Training-weekend day",
				"Team 0",
				"Team Rynke",
			]) {
				expect(html, part).not.toContain(part);
			}
			expect(html).toContain("amount-training");
			expect(html).toContain("bar-training");
		});

		it("explains the tick with Training's pace alone", () => {
			const hint = page().match(
				/<p class="team-hint" id="tour-pace">([^<]*)<\/p>/,
			)?.[1];
			expect(hint).toMatch(
				/^The tick on each bar marks the even pace to the deadline: today [^.]* Training\.$/,
			);
		});

		it("has Hamburg's Team part with Team Rynke", () => {
			const html = founding();
			expect(html).toContain("bar-team");
			expect(html).toContain('class="team-hint"');
		});

		it("reads the corrections and the qualified hint without Team", () => {
			const html = page();
			expect(html).toContain(en.t("organiser.overview.qualifiedHint.noEvents"));
			expect(html).not.toContain(en.t("organiser.overview.qualifiedHint"));
			expect(html).not.toContain(", 0 Team");
			expect(html).not.toContain(", 2 Team");
			expect(founding()).toContain(en.t("organiser.overview.qualifiedHint"));
		});

		it("has Training's coin alone in the Corrections column", () => {
			const pairs = [
				...page().matchAll(
					/<span class="coin-pair" aria-hidden="true">(.*?)<\/span><span class="visually-hidden">/g,
				),
			].map((m) => m[1] ?? "");
			expect(pairs.length).toBe(READ_NO_TEAM.length);
			for (const inner of pairs) expect(inner.split("<span>").length).toBe(2);
			expect(page()).toContain(
				'<span class="visually-hidden">6 Training</span>',
			);
		});
	});

	it("reads the corrections line of the full card without Team", () => {
		const html = overviewBody(
			READ_NO_TEAM,
			NO_TEAM,
			RUNNING,
			TODAY,
			"all",
			en,
			WITHOUT_EVENTS,
			new Map(),
			false,
			"full",
			null,
			"riders",
			null,
		).value;
		expect(html).toContain("<li>Corrections 6 Training</li>");
		expect(html).not.toContain("<li>Corrections 6 Training, 0 Team</li>");
	});
});

// Feature 039 research R15: rules that need no Training from outside virtual
// rides ask organisers about none either.
describe("the overview without Training needed outdoors", () => {
	const NONE: RynkeRules = { ...CURRENT_RULES, minOutsideTraining: 0 };
	/** What the evaluation stores then: nothing missing outdoors. */
	const allVirtual = (training: number, team: number): Balance => {
		const b = balance(training, team, 0);
		return {
			...b,
			virtualShareMissing: 0,
			qualified: b.trainingMissing === 0 && b.teamMissing === 0,
		};
	};
	const VERA = rider(1, "Vera", allVirtual(300, 30));
	const OLE = rider(2, "Ole", allVirtual(100, 20));

	it("misses no outdoor Training and groups by the rest", () => {
		const riders = overviewRiders([VERA, OLE], NONE, RUNNING, TODAY);
		for (const r of riders) expect(r.missing.outdoor.amount).toBe(0);
		expect(riders.find((r) => r.athleteId === 1)?.status).toBe("in");
		expect(riders.find((r) => r.athleteId === 2)?.status).toBe("push");
	});

	it("shows no outdoor figure, reason or amount to go", () => {
		const html = overviewBody(
			[VERA, OLE],
			NONE,
			RUNNING,
			TODAY,
			"all",
			en,
			hamburg,
			new Map(),
			false,
			"full",
		).value;
		for (const part of [
			"Outdoor Training",
			en.t("organiser.overview.reason.outdoor"),
			"outdoor Training to go",
		]) {
			expect(html, part).not.toContain(part);
		}
		expect(
			overviewBody(
				[VERA, OLE],
				CURRENT_RULES,
				RUNNING,
				TODAY,
				"all",
				en,
				hamburg,
				new Map(),
				false,
				"full",
			).value,
		).toContain("Outdoor Training 0 of 167");
	});
});
