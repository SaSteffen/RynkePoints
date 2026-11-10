import { describe, expect, it } from "vitest";
import { ART_VERSIONS } from "../../src/http/art-versions";
import type { Holiday } from "../../src/http/holidays";
import {
	HINT_MONKEYS,
	QUOTE_MONKEYS,
	SEASONAL_MONKEYS,
} from "../../src/http/quote-monkeys";
import { quoteArt, quoteId } from "../../src/http/sections/team";

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

// Seasonal monkeys (feature 035 contracts/quote-art.md): a team holiday's
// picture on every quote of a short window, and on about half of a long one.
describe("quoteArt on a holiday", () => {
	const MONKEYS = ["point", "thumbs", "banana", "flex", "wave"];
	const SEASONAL = ["christmas", "advent"];
	const CHRISTMAS: Holiday = {
		id: "christmas",
		monkey: "christmas",
		from: "12-24",
		to: "12-26",
		kind: "short",
	};
	const ADVENT: Holiday = {
		id: "advent",
		monkey: "advent",
		from: { anchor: "first-advent", offset: 0 },
		to: "12-23",
		kind: "long",
	};
	const ids = Array.from({ length: 40 }, (_, n) => quoteId(`Quote ${n}`));
	const regular = (id: string) => quoteArt({ list: "push", id }, MONKEYS);

	it("keeps today's picture without a holiday", () => {
		for (const id of ids)
			expect(quoteArt({ list: "push", id }, MONKEYS, null, SEASONAL)).toBe(
				`/quotes/${MONKEYS[Number.parseInt(id, 16) % MONKEYS.length]}.svg`,
			);
	});

	it("shows a short holiday's monkey on every quote", () => {
		for (const id of ids.slice(0, 20))
			expect(quoteArt({ list: "push", id }, MONKEYS, CHRISTMAS, SEASONAL)).toBe(
				"/quotes/christmas.svg",
			);
	});

	it("keeps today's picture while the holiday's monkey isn't built", () => {
		for (const id of ids) {
			expect(quoteArt({ list: "push", id }, MONKEYS, CHRISTMAS, [])).toBe(
				regular(id),
			);
			expect(
				quoteArt({ list: "push", id }, MONKEYS, ADVENT, ["christmas"]),
			).toBe(regular(id));
		}
	});

	it("falls back to the rider state's illustration without regular monkeys", () => {
		expect(
			quoteArt({ list: "push", id: ids[0] ?? "" }, [], null, SEASONAL),
		).toBe("/illustrations/status_push_fun.svg");
	});

	it("shows a long holiday's monkey when bit 16 of the quote id is set", () => {
		expect(
			quoteArt({ list: "push", id: "00010000" }, MONKEYS, ADVENT, SEASONAL),
		).toBe("/quotes/advent.svg");
		expect(
			quoteArt({ list: "push", id: "00020000" }, MONKEYS, ADVENT, SEASONAL),
		).toBe(regular("00020000"));
	});

	it("shows the Advent monkey on 30–70 % of 40 quotes, each always the same", () => {
		const arts = ids.map((id) =>
			quoteArt({ list: "push", id }, MONKEYS, ADVENT, SEASONAL),
		);
		const advent = arts.filter((art) => art === "/quotes/advent.svg").length;
		expect(advent).toBeGreaterThanOrEqual(12);
		expect(advent).toBeLessThanOrEqual(28);
		for (const [n, id] of ids.entries()) {
			expect(quoteArt({ list: "push", id }, MONKEYS, ADVENT, SEASONAL)).toBe(
				arts[n],
			);
			if (arts[n] !== "/quotes/advent.svg") expect(arts[n]).toBe(regular(id));
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
