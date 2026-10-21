import { describe, expect, it } from "vitest";
import { ART_VERSIONS } from "../../src/http/art-versions";
import { QUOTE_MONKEYS } from "../../src/http/quote-monkeys";
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
