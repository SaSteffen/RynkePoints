import { describe, expect, it } from "vitest";
import {
	BADGE_CATEGORIES,
	type BadgeCategoryId,
} from "../../src/badges/catalog";
import { easterSunday } from "../../src/badges/easter";
import { type CategoryProgress, progressOf } from "../../src/badges/evaluate";
import {
	type DailyFigures,
	type HintCandidate,
	type HintInput,
	hintCandidates,
	hintMonkey,
	hintVariant,
} from "../../src/badges/hints";
import { QUOTE_MONKEYS } from "../../src/http/quote-monkeys";
import type {
	ActiveEntry,
	DayEntry,
	OwnDayEntry,
} from "../../src/rynke/summary";

// Feature 034 contracts/hint-candidates.md: the hints in reach, from synthetic
// riders' figures only.

const SEASON = { seasonStart: "2026-09-01", seasonEnd: "2027-06-30" };

type Values = Partial<Record<BadgeCategoryId, number>>;

/** Progress for every personal category, `values` in the category's unit. */
function progress(values: Values): CategoryProgress[] {
	return BADGE_CATEGORIES.filter((c) => c.group === "personal").map((c) =>
		progressOf(c.id, values[c.id] ?? 0),
	);
}

function input(
	today: string,
	over: Partial<Omit<HintInput, "daily">> & {
		values?: Values;
		daily?: Partial<DailyFigures> | null;
	} = {},
): HintInput {
	const { values = {}, daily = {}, ...rest } = over;
	return {
		today,
		...SEASON,
		earned: new Set(),
		progress: progress(values),
		daily:
			daily === null
				? null
				: {
						days: [],
						runDays: [],
						virtualDays: [],
						ownDays: [],
						active: [],
						...daily,
					},
		longestSwimM: 0,
		ran: false,
		swam: false,
		...rest,
	};
}

const keys = (list: readonly HintCandidate[]) => list.map((c) => c.key);
const find = (list: readonly HintCandidate[], key: string) =>
	list.find((c) => c.key === key);

/** A ride day: `km` of counting rides, `m` of climbing. */
const day = (date: string, km: number, m = 0, rynke = 0): DayEntry => [
	date,
	km * 1000,
	rynke,
	m * 10,
];
const own = (date: string, km: number, outdoor: 0 | 1 = 1): OwnDayEntry => [
	date,
	km * 1000,
	outdoor,
];

describe("next-step hints", () => {
	it("Distance: 462 km of 500 with a 40 km best day → 38 km", () => {
		const list = hintCandidates(
			input("2026-11-20", {
				values: { distance: 462 },
				daily: { days: [day("2026-10-01", 40)] },
			}),
		);
		const hint = find(list, "next:distance");
		expect(hint?.values.n).toBe(38);
		expect(hint?.line).toBe("distance");
		expect(hint?.windowEnd).toBe("2027-06-30");
		expect(hint?.monkey).toBe("hint-down");
	});

	it("no amount hint larger than the days left times the best day (FR-006)", () => {
		// 2 days left at 10 km a day: 20 km fit, 38 don't.
		const list = hintCandidates(
			input("2027-06-29", {
				values: { distance: 462 },
				daily: { days: [day("2026-10-01", 10)] },
			}),
		);
		expect(find(list, "next:distance")).toBeUndefined();
		const fits = hintCandidates(
			input("2027-06-29", {
				values: { distance: 482 },
				daily: { days: [day("2026-10-01", 10)] },
			}),
		);
		expect(find(fits, "next:distance")?.values.n).toBe(18);
	});

	it("no amount hint without a ride day in the season", () => {
		const list = hintCandidates(
			input("2026-11-20", {
				values: { distance: 462 },
				daily: { days: [day("2026-08-20", 80)] },
			}),
		);
		expect(find(list, "next:distance")).toBeUndefined();
	});

	it("nothing without a summary row (research R2)", () => {
		expect(
			hintCandidates(
				input("2026-11-20", { values: { distance: 462 }, daily: null }),
			),
		).toEqual([]);
	});

	it("winter month: 4 November days on 20 Nov → one day to go", () => {
		const list = hintCandidates(
			input("2026-11-20", { values: { winter_november: 4 } }),
		);
		const hint = find(list, "next:winter_november");
		expect(hint).toMatchObject({
			line: "winterOne",
			values: { n: 1, month: 11 },
			windowEnd: "2026-11-30",
			monkey: "hint-calendar",
		});
	});

	it("winter month: in the month only, while the days still fit", () => {
		const at = (today: string, days: number) =>
			find(
				hintCandidates(input(today, { values: { winter_november: days } })),
				"next:winter_november",
			);
		// 28 Nov with 1 day: 4 missing, 3 days left.
		expect(at("2026-11-28", 1)).toBeUndefined();
		// 30 Nov with 4 days: today is enough.
		expect(at("2026-11-30", 4)?.line).toBe("winterOne");
		expect(at("2026-12-01", 4)).toBeUndefined();
		expect(at("2026-10-31", 4)).toBeUndefined();
		// 3 missing, 3 days left: no day to spare.
		expect(at("2026-11-28", 2)).toMatchObject({
			line: "winterNoSpare",
			values: { n: 3, left: 3 },
		});
		// 3 missing, 11 days left.
		expect(at("2026-11-20", 2)).toMatchObject({
			line: "winterSeveral",
			values: { n: 3, left: 11, month: 11 },
		});
	});

	it("winter month: a day already ridden outside today leaves from tomorrow", () => {
		// 30 Nov, 4 days including today: 1 missing, no day left.
		const ridden = hintCandidates(
			input("2026-11-30", {
				values: { winter_november: 4 },
				daily: { ownDays: [own("2026-11-30", 20)] },
			}),
		);
		expect(find(ridden, "next:winter_november")).toBeUndefined();
		// A trainer ride today doesn't count outside.
		const indoor = hintCandidates(
			input("2026-11-30", {
				values: { winter_november: 4 },
				daily: { ownDays: [own("2026-11-30", 20, 0)] },
			}),
		);
		expect(find(indoor, "next:winter_november")).toBeDefined();
	});

	it("January and February fall in the season's second year", () => {
		const list = hintCandidates(
			input("2027-01-10", { values: { winter_january: 7 } }),
		);
		expect(find(list, "next:winter_january")?.windowEnd).toBe("2027-01-31");
		expect(
			find(
				hintCandidates(input("2026-01-10", { values: { winter_january: 7 } })),
				"next:winter_january",
			),
		).toBeUndefined();
	});

	it("lengths: at least half the next step", () => {
		const at = (km: number) =>
			find(
				hintCandidates(input("2026-11-20", { values: { ride_length: km } })),
				"next:ride_length",
			);
		expect(at(55)).toMatchObject({
			line: "rideLength",
			values: { best: 55, next: 100 },
			monkey: "hint-tape",
		});
		// 20 km: the next step is 50 km, more than twice as far.
		expect(at(20)).toBeUndefined();
		expect(at(0)).toBeUndefined();
		expect(at(25)?.values.next).toBe(50);
		// 45 km of 50: in reach.
		expect(at(45)?.values).toEqual({ best: 45, next: 50 });
	});

	it("running, swimming and their lengths need a run or swim (FR-007)", () => {
		const values = {
			running: 20,
			run_length: 8,
			swimming: 8,
			swim_length: 0.8,
		};
		const daily = { runDays: [["2026-10-01", 6000]] as [string, number][] };
		const none = hintCandidates(
			input("2026-11-20", { values, daily, longestSwimM: 800 }),
		);
		expect(keys(none).filter((k) => /run|swim/.test(k))).toEqual([]);
		const both = hintCandidates(
			input("2026-11-20", {
				values,
				daily,
				longestSwimM: 800,
				ran: true,
				swam: true,
			}),
		);
		expect(keys(both)).toEqual(
			expect.arrayContaining([
				"next:running",
				"next:run_length",
				"next:swimming",
				"next:swim_length",
			]),
		);
		expect(find(both, "next:swim_length")?.values).toEqual({
			best: 0.8,
			next: 1,
		});
	});

	it("never complete categories, team events, technique or the tour (FR-008)", () => {
		const list = hintCandidates(
			input("2026-10-20", {
				values: { distance: 6000, team_events: 3, technique: 1 },
				daily: { days: [day("2026-10-01", 200)] },
			}),
		);
		expect(keys(list).filter((k) => k.startsWith("next:"))).toEqual([]);
	});

	it("orders by window end, then closeness, then key (FR-011)", () => {
		const list = hintCandidates(
			input("2026-11-20", {
				values: { winter_november: 4, distance: 462, elevation: 4500 },
				daily: { days: [day("2026-10-01", 40, 600)] },
			}),
		);
		const next = keys(list).filter((k) => k.startsWith("next:"));
		// November closes first; then distance (38 of 500) before elevation
		// (500 of 5,000).
		expect(next).toEqual([
			"next:winter_november",
			"next:distance",
			"next:elevation",
		]);
	});
});

describe("surprise hints", () => {
	/** Whether `rule`'s hint is there on `today`. */
	const has = (
		rule: string,
		today: string,
		over: Parameters<typeof input>[1] = {},
	) => keys(hintCandidates(input(today, over))).includes(`surprise:${rule}`);

	const window = (
		rule: string,
		first: string,
		last: string,
		before: string,
		after: string,
		over = {},
	) => {
		expect(has(rule, first, over)).toBe(true);
		expect(has(rule, last, over)).toBe(true);
		expect(has(rule, before, over)).toBe(false);
		expect(has(rule, after, over)).toBe(false);
	};

	it("New Year: 27 Dec to 1 Jan", () =>
		window("new-year", "2026-12-27", "2027-01-01", "2026-12-26", "2027-01-02"));

	it("Christmas Eve: 17 to 24 Dec", () =>
		window(
			"christmas-eve",
			"2026-12-17",
			"2026-12-24",
			"2026-12-16",
			"2026-12-25",
		));

	it("Christmas: 17 to 26 Dec", () =>
		window(
			"christmas",
			"2026-12-17",
			"2026-12-26",
			"2026-12-16",
			"2026-12-27",
		));

	it("Festive 500: 17 to 31 Dec; from the 24th only while 500 km still fit", () => {
		const fit = { daily: { days: [day("2026-10-01", 100)] } };
		// Up to the 23rd always; 24 Dec: 8 days × 100 km fit 500 km.
		window(
			"festive-500",
			"2026-12-17",
			"2026-12-24",
			"2026-12-16",
			"2027-01-01",
			fit,
		);
		// 31 Dec with nothing since the 24th: 500 km don't fit in a day.
		expect(has("festive-500", "2026-12-31", fit)).toBe(false);
		const slow = { daily: { days: [day("2026-10-01", 50)] } };
		// 18 Dec: always; 24 Dec: 8 days × 50 km < 500 km.
		expect(has("festive-500", "2026-12-18", slow)).toBe(true);
		expect(has("festive-500", "2026-12-24", slow)).toBe(false);
		// 30 Dec, 420 km since the 24th, best day 100: 80 km in 2 days fit.
		const close = {
			daily: {
				days: [
					day("2026-10-01", 100),
					...["24", "25", "26", "27", "28", "29"].map((d) =>
						day(`2026-12-${d}`, 70),
					),
				],
			},
		};
		expect(has("festive-500", "2026-12-30", close)).toBe(true);
	});

	it("night owl and early bird: the season, after a counting ride", () => {
		const rode = { daily: { days: [day("2026-10-01", 20)] } };
		expect(has("night-owl", "2026-11-20", rode)).toBe(true);
		expect(has("early-bird", "2026-11-20", rode)).toBe(true);
		expect(has("night-owl", "2026-11-20")).toBe(false);
		expect(has("early-bird", "2026-11-20")).toBe(false);
	});

	it("an earned surprise badge has no hint", () => {
		const rode = { daily: { days: [day("2026-10-01", 20)] } };
		expect(
			has("early-bird", "2026-11-20", {
				...rode,
				earned: new Set(["surprise-early-bird"]),
			}),
		).toBe(false);
		expect(
			has("christmas-eve", "2026-12-20", {
				earned: new Set(["surprise-christmas-eve"]),
			}),
		).toBe(false);
	});

	it("rest day: 5 active days in a row ending today or yesterday", () => {
		const streak = (end: string, n: number): ActiveEntry[] =>
			Array.from({ length: n }, (_, i) => [
				new Date(Date.parse(`${end}T00:00:00Z`) - i * 86_400_000)
					.toISOString()
					.slice(0, 10),
				9,
				1,
			]);
		const list = hintCandidates(
			input("2026-11-20", { daily: { active: streak("2026-11-19", 6) } }),
		);
		expect(find(list, "surprise:rest-day")?.values.n).toBe(6);
		expect(
			has("rest-day", "2026-11-20", {
				daily: { active: streak("2026-11-20", 5) },
			}),
		).toBe(true);
		expect(
			has("rest-day", "2026-11-20", {
				daily: { active: streak("2026-11-20", 4) },
			}),
		).toBe(false);
		expect(
			has("rest-day", "2026-11-20", {
				daily: { active: streak("2026-11-18", 7) },
			}),
		).toBe(false);
	});

	it("Etappenfahrer: after a day of 70 km in the season", () => {
		expect(
			has("stage-rider", "2026-11-20", {
				daily: { days: [day("2026-10-01", 70)] },
			}),
		).toBe(true);
		expect(
			has("stage-rider", "2026-11-20", {
				daily: { days: [day("2026-10-01", 69)] },
			}),
		).toBe(false);
	});

	it("Dreikampf: needs both a run and a swim (FR-007)", () => {
		expect(has("triathlon", "2026-11-20", { ran: true, swam: true })).toBe(
			true,
		);
		expect(has("triathlon", "2026-11-20", { ran: true })).toBe(false);
		expect(has("triathlon", "2026-11-20", { swam: true })).toBe(false);
	});

	it("Kreiszahl: 7 to 14 March, after a 25 km ride in the season", () => {
		const long = { daily: { ownDays: [own("2026-10-01", 25)] } };
		window(
			"pi-day",
			"2027-03-07",
			"2027-03-14",
			"2027-03-06",
			"2027-03-15",
			long,
		);
		expect(
			has("pi-day", "2027-03-10", {
				daily: { ownDays: [own("2026-10-01", 24)] },
			}),
		).toBe(false);
	});

	it("Sonnenwende: 14 to 21 Dec; 14 to 21 Jun after riding outside on 21 Dec", () => {
		window("solstice", "2026-12-14", "2026-12-21", "2026-12-13", "2026-12-22");
		const list = hintCandidates(input("2026-12-14"));
		expect(find(list, "surprise:solstice")?.line).toBe("solsticeDecember");
		const rode = { daily: { ownDays: [own("2026-12-21", 15)] } };
		window(
			"solstice",
			"2027-06-14",
			"2027-06-21",
			"2027-06-13",
			"2027-06-22",
			rode,
		);
		expect(
			find(hintCandidates(input("2027-06-14", rode)), "surprise:solstice")
				?.line,
		).toBe("solsticeJune");
		expect(has("solstice", "2027-06-15")).toBe(false);
		expect(
			has("solstice", "2027-06-15", {
				daily: { ownDays: [own("2026-12-21", 15, 0)] },
			}),
		).toBe(false);
	});

	it("Easter: the 7 days before Easter Monday, and Easter Monday", () => {
		for (const year of [2027]) {
			const monday = new Date(
				Date.parse(`${easterSunday(year)}T00:00:00Z`) + 86_400_000,
			);
			const at = (days: number) =>
				new Date(monday.getTime() + days * 86_400_000)
					.toISOString()
					.slice(0, 10);
			window("easter", at(-7), at(0), at(-8), at(1));
		}
		// Easter 2028 (16/17 April) lies after this season's end.
		const late = { seasonStart: "2027-09-01", seasonEnd: "2028-06-30" };
		expect(has("easter", "2028-04-14", late)).toBe(true);
		expect(has("easter", "2028-04-18", late)).toBe(false);
	});

	it("Everesting: while the month's rest still fits at the best climbing day", () => {
		const climb = (best: number, done: number) => ({
			daily: {
				days: [
					day("2026-10-01", 50, best),
					day("2026-11-02", 50, done / 2),
					day("2026-11-03", 50, done / 2),
				],
			},
		});
		// 20 Nov: 11 days left × 800 m = 8,800 m; 1,000 m done, 7,848 missing.
		expect(has("everesting", "2026-11-20", climb(800, 1000))).toBe(true);
		expect(has("everesting", "2026-11-20", climb(600, 1000))).toBe(false);
		const list = hintCandidates(input("2026-11-20", climb(800, 1000)));
		expect(find(list, "surprise:everesting")?.windowEnd).toBe("2026-11-30");
		expect(has("everesting", "2026-11-20")).toBe(false);
	});

	it("Winterschlaf beendet: from 1 Jan, until an outdoor ride since then", () => {
		expect(has("winter-sleep", "2027-01-01")).toBe(true);
		expect(has("winter-sleep", "2027-06-30")).toBe(true);
		expect(has("winter-sleep", "2026-12-31")).toBe(false);
		expect(
			has("winter-sleep", "2027-02-01", {
				daily: { ownDays: [own("2027-01-05", 10)] },
			}),
		).toBe(false);
		expect(
			has("winter-sleep", "2027-02-01", {
				daily: { ownDays: [own("2027-01-05", 10, 0)] },
			}),
		).toBe(true);
	});

	it("surprise hints link to the surprise card, closeness 1", () => {
		const hint = find(
			hintCandidates(input("2026-12-20")),
			"surprise:christmas-eve",
		);
		expect(hint).toMatchObject({
			category: "surprise",
			closeness: 1,
			line: "christmasEve",
			monkey: "hint-psst",
		});
	});
});

describe("SC-001: every candidate can still be earned in time", () => {
	const dates: string[] = [];
	for (
		let t = Date.parse("2026-09-01T00:00:00Z");
		t <= Date.parse("2027-06-30T00:00:00Z");
		t += 86_400_000
	) {
		dates.push(new Date(t).toISOString().slice(0, 10));
	}

	/** A synthetic rider's season: which days they ride, and how far. */
	const riders: Record<string, (date: string, i: number) => number> = {
		commuter: (date) => ([0, 6].includes(new Date(date).getUTCDay()) ? 0 : 15),
		weekend: (date) => ([0, 6].includes(new Date(date).getUTCDay()) ? 90 : 0),
		allround: (_date, i) => (i % 3 === 0 ? 40 : 0),
	};

	const daysLeft = (from: string, to: string) =>
		Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
	const monthEnd = (date: string) =>
		new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0))
			.toISOString()
			.slice(0, 10);

	for (const [name, ride] of Object.entries(riders)) {
		it(`${name}: no hint out of reach on any day of the season`, () => {
			const all = dates.map((date, i) => ({ date, km: ride(date, i) }));
			for (const [i, today] of dates.entries()) {
				const sofar = all.slice(0, i + 1).filter((d) => d.km > 0);
				const km = sofar.reduce((sum, d) => sum + d.km, 0);
				const best = Math.max(0, ...sofar.map((d) => d.km));
				const winter: Values = {};
				for (const c of BADGE_CATEGORIES) {
					if (c.month === undefined) continue;
					winter[c.id] = sofar.filter(
						(d) => Number(d.date.slice(5, 7)) === c.month,
					).length;
				}
				const list = hintCandidates(
					input(today, {
						values: { distance: km, ride_length: best, ...winter },
						daily: {
							days: sofar.map((d) => day(d.date, d.km)),
							ownDays: sofar.map((d) => own(d.date, d.km)),
							active: sofar.map((d) => [d.date, 9, 1] as ActiveEntry),
						},
						ran: name === "allround",
						swam: name === "allround",
					}),
				);
				for (const hint of list) {
					expect(today <= hint.windowEnd).toBe(true);
					expect(hint.windowEnd <= SEASON.seasonEnd).toBe(true);
					const n = hint.values.n ?? 0;
					if (hint.key === "next:distance") {
						expect(n).toBeLessThanOrEqual(
							daysLeft(today, SEASON.seasonEnd) * best,
						);
					}
					if (hint.key.startsWith("next:winter_")) {
						const ridden = sofar.some((d) => d.date === today);
						expect(n).toBeLessThanOrEqual(
							daysLeft(today, monthEnd(today)) - (ridden ? 1 : 0),
						);
						expect(hint.windowEnd).toBe(monthEnd(today));
					}
					if (hint.key === "next:ride_length") {
						expect(best * 2).toBeGreaterThanOrEqual(hint.values.next ?? 0);
					}
				}
			}
		});
	}
});

describe("hintMonkey and hintVariant", () => {
	const kinds: [string, string][] = [
		["distance", "hint-down"],
		["training_rynke", "hint-down"],
		["virtual_rides", "hint-down"],
		["winter_february", "hint-calendar"],
		["swim_length", "hint-tape"],
	];
	it("each kind gets its monkey", () => {
		expect(hintMonkey({ monkey: "hint-psst" })).toBe("/quotes/hint-psst.svg");
		for (const [category, monkey] of kinds) {
			const list = hintCandidates(
				input("2027-02-10", {
					values: {
						[category]:
							0.6 * (progressOf(category as BadgeCategoryId, 0).next ?? 1),
					},
					daily: {
						days: [day("2026-10-01", 100, 1000, 30)],
						virtualDays: [["2026-10-02", 100_000]],
					},
					longestSwimM: 3000,
					ran: true,
					swam: true,
				}),
			);
			expect(find(list, `next:${category}`)?.monkey).toBe(monkey);
		}
	});

	it("falls back to the first quote monkey while one isn't built", () => {
		expect(hintMonkey({ monkey: "hint-psst" }, [])).toBe(
			`/quotes/${QUOTE_MONKEYS[0]}.svg`,
		);
	});

	it("keeps a hint's words all day", () => {
		const a = hintVariant("next:distance", "2026-11-20", 2);
		expect(hintVariant("next:distance", "2026-11-20", 2)).toBe(a);
		expect([0, 1]).toContain(a);
		expect(hintVariant("next:distance", "2026-11-20", 1)).toBe(0);
		const seen = new Set(
			Array.from({ length: 30 }, (_, i) =>
				hintVariant(
					"next:distance",
					`2026-11-${String(i + 1).padStart(2, "0")}`,
					2,
				),
			),
		);
		expect(seen.size).toBe(2);
	});
});
