import { describe, expect, it } from "vitest";
import { artUrl } from "../../src/http/art";
import { HERO_PORTRAITS, heroCoin } from "../../src/http/coin";

// The Du page's hero coin: one of Rynke's portraits at random (art/coin/hero/).
describe("heroCoin", () => {
	const src = (pick: number) =>
		heroCoin(pick)
			.toString()
			.match(/src="([^"]+)"/)?.[1];

	it("spreads the picks evenly over every portrait", () => {
		expect(HERO_PORTRAITS).toBe(4);
		expect(src(0)).toBe(artUrl("/coin/rynke-coin-hero-1.svg"));
		expect(src(0.249)).toBe(artUrl("/coin/rynke-coin-hero-1.svg"));
		expect(src(0.25)).toBe(artUrl("/coin/rynke-coin-hero-2.svg"));
		expect(src(0.5)).toBe(artUrl("/coin/rynke-coin-hero-3.svg"));
		expect(src(0.999999)).toBe(artUrl("/coin/rynke-coin-hero-4.svg"));
	});

	it("is decoration sized like the hero coin", () => {
		expect(heroCoin(0).toString()).toBe(
			`<img class="coin-art coin coin-hero" src="${artUrl("/coin/rynke-coin-hero-1.svg")}" alt="" width="144" height="144">`,
		);
	});
});
