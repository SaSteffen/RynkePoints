import { describe, expect, it } from "vitest";
import { phraseSet } from "../../src/content";
import { ART_VERSIONS } from "../../src/http/art-versions";
import type { Holiday } from "../../src/http/holidays";
import {
	HINT_MONKEYS,
	QUOTE_MONKEYS,
	SEASONAL_MONKEYS,
} from "../../src/http/quote-monkeys";
import { quoteArt, quoteId } from "../../src/http/sections/team";
import { europe } from "../../teams/europe/team";
import { hamburg } from "../../teams/hamburg/team";

// Which picture of Rynke says the Team page's quote (Quote Monkey draft,
// option B): one of the quote monkeys from `pnpm badge-build`, or the rider
// state's illustration while there are none.

describe("quoteArt", () => {
	const MONKEYS = ["point", "thumbs", "banana", "flex", "wave"];

	it("gives the same quote the same monkey", () => {
		const id = quoteId("Jeder Kilometer zählt.");
		const art = quoteArt({ list: "push", id }, MONKEYS);
		expect(art).toMatch(/^\/quotes\/(point|thumbs|banana|flex|wave)\.svg$/);
		expect(quoteArt({ list: "onTrack", id }, MONKEYS)).toBe(art);
	});

	it("spreads the quotes over every monkey", () => {
		const used = new Set(
			Array.from({ length: 200 }, (_, n) =>
				quoteArt({ list: "push", id: quoteId(`Quote ${n}`) }, MONKEYS),
			),
		);
		expect(used.size).toBe(MONKEYS.length);
	});

	it("falls back to the rider state's illustration without monkeys", () => {
		const id = quoteId("Jeder Kilometer zählt.");
		expect(quoteArt({ list: "push", id }, [])).toBe(
			"/illustrations/status_push_fun.svg",
		);
		expect(quoteArt({ list: "onTrack", id }, [])).toBe(
			"/illustrations/status_on_track_fun.svg",
		);
	});

	it("only uses monkeys whose picture is built", () => {
		for (const monkey of QUOTE_MONKEYS)
			expect(ART_VERSIONS[`/quotes/${monkey}.svg`]).toBeDefined();
	});
});

// Seasonal monkeys (feature 035 contracts/quote-art.md, feature 038
// contracts/quote-art.md): a picture of the day's set on every quote of a short
// window, and on about half of a long one; a tie's sets together.
describe("quoteArt on a holiday", () => {
	const MONKEYS = ["point", "thumbs", "banana", "flex", "wave"];
	const ADVENT_SET_MONKEYS = [
		"advent",
		"christmas-market",
		"mulled-wine",
		"christmas-biscuits",
	];
	const SEASONAL = [
		"christmas",
		...ADVENT_SET_MONKEYS,
		"nikolaus",
		"advent-wreath-1",
		"advent-wreath-2",
	];
	const CHRISTMAS: Holiday = {
		id: "christmas",
		monkeys: ["christmas"],
		from: "12-25",
		to: "12-26",
		kind: "short",
	};
	const ADVENT: Holiday = {
		id: "advent",
		monkeys: ["advent"],
		from: { anchor: "first-advent", offset: 0 },
		to: "12-23",
		kind: "long",
	};
	const ADVENT_SET: Holiday = { ...ADVENT, monkeys: ADVENT_SET_MONKEYS };
	const NIKOLAUS: Holiday = {
		id: "nikolaus",
		monkeys: ["nikolaus"],
		from: "12-06",
		to: "12-06",
		kind: "short",
	};
	const sunday = (n: number): Holiday => ({
		id: `advent-${n}`,
		monkeys: [`advent-wreath-${n}`],
		from: { anchor: "first-advent", offset: 7 * (n - 1) },
		to: { anchor: "first-advent", offset: 7 * (n - 1) },
		kind: "short",
	});
	const ids = Array.from({ length: 40 }, (_, n) => quoteId(`Quote ${n}`));
	// "Quote 0" … "Quote 39" differ only in their last digits, which FNV-1a
	// mixes poorly into the high bits a set's pick uses; the spread is measured
	// on 40 of each team's December quotes, as research R3 did.
	const DECEMBER = [hamburg, europe].map((team) => {
		const set = phraseSet(team).set;
		const quotes = [
			...set.push,
			...set.onTrack,
			...set.seasonPush.winter,
			...set.seasonOnTrack.winter,
		];
		return [team.id, quotes.slice(0, 40).map(quoteId)] as const;
	});
	const regular = (id: string) => quoteArt({ list: "push", id }, MONKEYS);
	const art = (
		id: string,
		holidays: readonly Holiday[],
		seasonal: readonly string[] = SEASONAL,
	) => quoteArt({ list: "push", id }, MONKEYS, holidays, seasonal);
	const share = (arts: readonly string[], picture: string) =>
		arts.filter((a) => a === `/quotes/${picture}.svg`).length;

	it("keeps today's picture without a holiday", () => {
		for (const id of ids)
			expect(art(id, [])).toBe(
				`/quotes/${MONKEYS[Number.parseInt(id, 16) % MONKEYS.length]}.svg`,
			);
	});

	it("shows a short holiday's monkey on every quote", () => {
		for (const id of ids.slice(0, 20))
			expect(art(id, [CHRISTMAS])).toBe("/quotes/christmas.svg");
	});

	it("keeps today's picture while the holiday's monkey isn't built", () => {
		for (const id of ids) {
			expect(art(id, [CHRISTMAS], [])).toBe(regular(id));
			expect(art(id, [ADVENT], ["christmas"])).toBe(regular(id));
		}
	});

	it("falls back to the rider state's illustration without regular monkeys", () => {
		expect(quoteArt({ list: "push", id: ids[0] ?? "" }, [], [], SEASONAL)).toBe(
			"/illustrations/status_push_fun.svg",
		);
	});

	it("shows a long holiday's monkey when bit 16 of the quote id is set", () => {
		expect(art("00010000", [ADVENT])).toBe("/quotes/advent.svg");
		expect(art("00020000", [ADVENT])).toBe(regular("00020000"));
	});

	it("shows the Advent monkey on 30–70 % of 40 quotes, each always the same", () => {
		const arts = ids.map((id) => art(id, [ADVENT]));
		const advent = share(arts, "advent");
		expect(advent).toBeGreaterThanOrEqual(12);
		expect(advent).toBeLessThanOrEqual(28);
		for (const [n, id] of ids.entries()) {
			expect(art(id, [ADVENT])).toBe(arts[n]);
			if (arts[n] !== "/quotes/advent.svg") expect(arts[n]).toBe(regular(id));
		}
	});

	it("picks from a long window's set by the quote id", () => {
		for (const id of ids) {
			const v = Number.parseInt(id, 16);
			expect(art(id, [ADVENT_SET])).toBe(
				((v >>> 16) & 1) === 1
					? `/quotes/${ADVENT_SET_MONKEYS[Math.floor(v / 2 ** 17) % 4]}.svg`
					: regular(id),
			);
		}
	});

	it.each(DECEMBER)(
		"spreads %s's Advent quotes over the whole set",
		(_, quotes) => {
			const arts = quotes.map((id) => art(id, [ADVENT_SET]));
			const advent = ADVENT_SET_MONKEYS.reduce(
				(sum, picture) => sum + share(arts, picture),
				0,
			);
			expect(advent).toBeGreaterThanOrEqual(0.3 * quotes.length);
			expect(advent).toBeLessThanOrEqual(0.7 * quotes.length);
			for (const picture of ADVENT_SET_MONKEYS) {
				expect(share(arts, picture), picture).toBeGreaterThan(0);
				expect(share(arts, picture), picture).toBeLessThanOrEqual(
					(2 * advent) / ADVENT_SET_MONKEYS.length,
				);
			}
		},
	);

	it("keeps a quote's picture on every day of the same windows", () => {
		for (const id of ids)
			expect(art(id, [ADVENT_SET])).toBe(art(id, [ADVENT_SET]));
	});

	it.each(DECEMBER)(
		"leaves an unbuilt picture out of %s's set",
		(_, quotes) => {
			const built = SEASONAL.filter((m) => m !== "mulled-wine");
			const arts = quotes.map((id) => art(id, [ADVENT_SET], built));
			expect(share(arts, "mulled-wine")).toBe(0);
			for (const picture of [
				"advent",
				"christmas-market",
				"christmas-biscuits",
			])
				expect(share(arts, picture), picture).toBeGreaterThan(0);
			for (const id of quotes)
				expect(art(id, [ADVENT_SET], ["advent"])).toBe(art(id, [ADVENT]));
		},
	);

	it.each(DECEMBER)(
		"splits %s's quotes on a tie of two short one-picture windows",
		(_, quotes) => {
			const arts = quotes.map((id) => art(id, [NIKOLAUS, sunday(2)]));
			for (const a of arts)
				expect([
					"/quotes/nikolaus.svg",
					"/quotes/advent-wreath-2.svg",
				]).toContain(a);
			for (const picture of ["nikolaus", "advent-wreath-2"]) {
				expect(share(arts, picture), picture).toBeGreaterThanOrEqual(
					0.3 * quotes.length,
				);
				expect(share(arts, picture), picture).toBeLessThanOrEqual(
					0.7 * quotes.length,
				);
			}
		},
	);

	it("shows every quote a picture when any tied window is short", () => {
		const set = [...ADVENT_SET_MONKEYS, "advent-wreath-1"];
		for (const id of ids)
			expect(set.map((m) => `/quotes/${m}.svg`)).toContain(
				art(id, [ADVENT_SET, sunday(1)]),
			);
	});

	it("drops duplicates in a tie's set", () => {
		const eve: Holiday = {
			...CHRISTMAS,
			id: "christmas-eve",
			from: "12-24",
			to: "12-24",
		};
		const both: Holiday = {
			...eve,
			id: "both",
			monkeys: ["christmas", "nikolaus"],
		};
		for (const id of ids) {
			expect(art(id, [eve, { ...eve, id: "again" }])).toBe(
				"/quotes/christmas.svg",
			);
			const pick = ["christmas", "nikolaus"][
				Math.floor(Number.parseInt(id, 16) / 2 ** 17) % 2
			];
			expect(art(id, [eve, both])).toBe(`/quotes/${pick}.svg`);
		}
	});

	it("only lists seasonal monkeys whose picture is built, apart from the regular ones", () => {
		for (const monkey of SEASONAL_MONKEYS) {
			expect(ART_VERSIONS[`/quotes/${monkey}.svg`]).toBeDefined();
			expect(QUOTE_MONKEYS).not.toContain(monkey);
		}
	});

	it("keeps the badges page's hint monkeys out of the Team page's lists", () => {
		for (const monkey of HINT_MONKEYS) {
			expect(ART_VERSIONS[`/quotes/${monkey}.svg`]).toBeDefined();
			expect(QUOTE_MONKEYS).not.toContain(monkey);
			expect(SEASONAL_MONKEYS).not.toContain(monkey);
		}
	});
});
