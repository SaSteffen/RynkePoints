import { describe, expect, it } from "vitest";
import {
	peloton,
	sparkline,
	thresholdBars,
	weekBars,
} from "../../src/http/charts";

// The inline SVG charts of the Team page (016 research R5, R12). No library and
// no client script.

const pointsOf = (svg: string) =>
	(svg.match(/<polyline[^>]* points="([^"]*)"/)?.[1] ?? "")
		.split(" ")
		.filter(Boolean)
		.map((pair) => pair.split(",").map(Number));

describe("sparkline", () => {
	it("is one labelled image that stretches to its box", () => {
		const svg = sparkline([0, 4, 9], "Week by week: 0, 4, 9").value;
		expect(svg.match(/<svg[\s>]/g)).toHaveLength(1);
		expect(svg).toMatch(/^<svg [^>]*role="img"/);
		expect(svg).toContain('aria-label="Week by week: 0, 4, 9"');
		expect(svg).toMatch(/ viewBox="0 0 \d+ \d+"/);
		expect(svg).toContain('preserveAspectRatio="none"');
		expect(svg.match(/<polyline/g)).toHaveLength(1);
	});

	it("escapes the label", () => {
		const svg = sparkline([1], `"<&>'`).value;
		expect(svg).toContain('aria-label="&quot;&lt;&amp;&gt;&#39;"');
	});

	it("draws one point per value, rising with the values", () => {
		const points = pointsOf(sparkline([0, 4, 9, 9], "x").value);
		expect(points).toHaveLength(4);
		const ys = points.map(([, y]) => y ?? Number.NaN);
		// SVG's y grows downwards.
		expect(ys[0]).toBeGreaterThan(ys[1] ?? 0);
		expect(ys[1]).toBeGreaterThan(ys[2] ?? 0);
		expect(ys[2]).toBe(ys[3]);
		const xs = points.map(([x]) => x ?? Number.NaN);
		expect(xs).toEqual([...xs].sort((a, b) => a - b));
	});

	it("draws a flat line, not NaN, when every value is 0", () => {
		const svg = sparkline([0, 0, 0], "x").value;
		expect(svg).not.toContain("NaN");
		const points = pointsOf(svg);
		expect(points).toHaveLength(3);
		expect(new Set(points.map(([, y]) => y)).size).toBe(1);
	});

	it("draws a single value without NaN", () => {
		const svg = sparkline([5], "x").value;
		expect(svg).not.toContain("NaN");
		expect(pointsOf(svg)).toHaveLength(1);
	});
});

describe("peloton", () => {
	const TEXT = {
		label: "4 riders between 0 and 30 Rynke; you have 20",
		you: "You",
	};
	/** The riders' mini coins, then the viewer's front. */
	const coinsOf = (svg: string) =>
		[...svg.matchAll(/<use [^>]*href="#coin-(?:mini|front)"[^>]*>/g)].map(
			(m) => m[0],
		);
	const sizeOf = (use: string) => Number(use.match(/ width="([\d.]+)"/)?.[1]);
	const xOf = (use: string) => Number(use.match(/ x="([\d.]+)"/)?.[1]);
	const centreOf = (use: string) => xOf(use) + sizeOf(use) / 2;
	/** The x coordinates of the gap's corners. */
	const gapOf = (svg: string) =>
		[
			...(svg.match(/<path class="road-gap" d="([^"]*)"/)?.[1] ?? "").matchAll(
				/[ML]([\d.]+) [\d.]+/g,
			),
		].map((m) => Number(m[1]));

	it("is one labelled image with one coin per total", () => {
		const svg = peloton([30, 20, 10, 0], 1, null, TEXT, "training").value;
		expect(svg.match(/<svg[\s>]/g)).toHaveLength(1);
		expect(svg).toMatch(/^<svg [^>]*role="img"/);
		expect(svg).toContain(`aria-label="${TEXT.label}"`);
		expect(coinsOf(svg)).toHaveLength(4);
		expect(svg.match(/href="#coin-mini"/g)).toHaveLength(3);
		expect(svg).not.toContain("NaN");
	});

	it("draws the viewer's coin as the larger front, last, with the You tag", () => {
		const svg = peloton([30, 20, 10, 0], 1, null, TEXT, "training").value;
		const coins = coinsOf(svg);
		const own = coins.at(-1) ?? "";
		expect(own).toContain('href="#coin-front"');
		for (const other of coins.slice(0, -1)) {
			expect(sizeOf(own)).toBeGreaterThan(sizeOf(other));
		}
		expect(svg).toMatch(/<text[^>]*>You<\/text>/);
	});

	it("places each coin by its total, the largest furthest ahead", () => {
		const coins = coinsOf(
			peloton([30, 20, 10, 0], 3, null, TEXT, "training").value,
		);
		const others = coins.slice(0, -1).map(xOf);
		expect(others[0]).toBeGreaterThan(others[1] ?? 0);
		expect(others[1]).toBeGreaterThan(others[2] ?? 0);
		expect(xOf(coins.at(-1) ?? "")).toBeLessThan(others[2] ?? 0);
	});

	it("draws no threshold line", () => {
		const svg = peloton([300, 20], 1, null, TEXT, "training").value;
		expect(svg).not.toContain("<line");
		expect(svg).not.toContain("threshold");
	});

	it("turns the coins Elbe blue for Team", () => {
		expect(peloton([1], 0, null, TEXT, "team").value).toContain("coin-team");
		expect(peloton([1], 0, null, TEXT, "training").value).not.toContain(
			"coin-team",
		);
	});

	it("escapes the texts", () => {
		const svg = peloton(
			[1],
			0,
			null,
			{ label: "<&>", you: "<b>" },
			"training",
		).value;
		expect(svg).toContain('aria-label="&lt;&amp;&gt;"');
		expect(svg).toContain("&lt;b&gt;");
	});

	it("puts every coin at the start when all totals are 0", () => {
		const coins = coinsOf(peloton([0, 0], 0, null, TEXT, "training").value);
		expect(coins.join("")).not.toContain("NaN");
		const centres = coins.map((use) => xOf(use) + sizeOf(use) / 2);
		expect(new Set(centres).size).toBe(1);
	});

	it("spreads the road from end to end without a breakaway (US2 #5)", () => {
		const svg = peloton([30, 20, 10, 0], 3, null, TEXT, "training").value;
		expect(svg).not.toContain("road-gap");
		const centres = coinsOf(svg).map(centreOf);
		expect(centres).toEqual([298, 206, 114, 22]);
	});

	describe("with a breakaway (FR-018, research R13)", () => {
		it("cuts the road with a slanted gap at 237", () => {
			const svg = peloton([1, 2, 3, 4, 100], 0, 7, TEXT, "training").value;
			const xs = gapOf(svg);
			expect(xs).toHaveLength(4);
			expect(new Set(xs).size).toBe(4);
			expect(xs.reduce((sum, x) => sum + x, 0) / xs.length).toBe(237);
		});

		it("draws the bunch to scale up to 198 and the breakaway past the gap", () => {
			const coins = coinsOf(
				peloton([1, 2, 3, 4, 100], 0, 7, TEXT, "training").value,
			);
			// The others in order, then the viewer with 1.
			expect(coins.map(centreOf)).toEqual([110, 154, 198, 282, 66]);
		});

		it("orders the breakaway evenly from 269 to 294", () => {
			const coins = coinsOf(
				peloton([1, 2, 3, 4, 5, 6, 900, 400], 0, 20, TEXT, "training").value,
			);
			expect(coins.slice(5, 7).map(centreOf)).toEqual([294, 269]);
		});

		it("puts equal breakaway totals at one position", () => {
			const coins = coinsOf(
				peloton([1, 2, 3, 4, 5, 6, 400, 400, 900], 0, 20, TEXT, "training")
					.value,
			);
			expect(coins.slice(5, 8).map(centreOf)).toEqual([269, 269, 294]);
		});

		it("keeps a bunch without Rynke at the back", () => {
			const coins = coinsOf(
				peloton([0, 0, 0, 0, 0, 0, 50, 80], 0, 31.25, TEXT, "training").value,
			);
			expect(coins.map(centreOf)).toEqual([22, 22, 22, 22, 22, 269, 294, 22]);
		});

		it("draws a viewer in the breakaway past the gap, the tag on the road", () => {
			const svg = peloton([1, 2, 3, 4, 100], 4, 7, TEXT, "training").value;
			const own = coinsOf(svg).at(-1) ?? "";
			expect(own).toContain('href="#coin-front"');
			expect(sizeOf(own)).toBe(40);
			expect(centreOf(own)).toBe(282);
			const tag = svg.match(/<g class="peloton-you"><rect [^>]*>/)?.[0] ?? "";
			const x = Number(tag.match(/ x="([\d.]+)"/)?.[1]);
			const width = Number(tag.match(/ width="([\d.]+)"/)?.[1]);
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x + width).toBeLessThanOrEqual(320);
		});
	});
});

describe("weekBars", () => {
	const rectsOf = (svg: string) => svg.match(/<rect [^>]*>/g) ?? [];
	const heightOf = (rect: string) =>
		Number(rect.match(/ height="([\d.]+)"/)?.[1]);

	it("is one labelled image with one bar per week, stretched", () => {
		const svg = weekBars([0, 10, 25], "Team Training, 3 weeks").value;
		expect(svg.match(/<svg[\s>]/g)).toHaveLength(1);
		expect(svg).toMatch(/^<svg [^>]*role="img"/);
		expect(svg).toContain('aria-label="Team Training, 3 weeks"');
		expect(svg).toContain('preserveAspectRatio="none"');
		expect(rectsOf(svg)).toHaveLength(3);
	});

	it("marks the last bar as the current week", () => {
		const rects = rectsOf(weekBars([0, 10, 25], "x").value);
		expect(rects.map((r) => r.includes('class="current"'))).toEqual([
			false,
			false,
			true,
		]);
	});

	it("draws each bar as high as its total", () => {
		const heights = rectsOf(weekBars([0, 10, 20], "x").value).map(heightOf);
		expect(heights[0]).toBe(0);
		expect(heights[2]).toBeCloseTo((heights[1] ?? 0) * 2, 0);
	});

	it("draws no NaN when every total is 0", () => {
		const svg = weekBars([0, 0], "x").value;
		expect(svg).not.toContain("NaN");
		expect(rectsOf(svg)).toHaveLength(2);
	});
});

describe("thresholdBars", () => {
	const widthOf = (svg: string) =>
		Number(svg.match(/class="threshold-fill"[^>]* width="([^"]*)"/)?.[1]);
	const tickOf = (svg: string) =>
		svg.match(/<line class="pace-mark" x1="([^"]*)"/)?.[1];

	it("is decoration: the card or table cell carries the figures (research R12)", () => {
		const svg = thresholdBars(100, 250, 138).value;
		expect(svg).toMatch(/^<svg class="threshold-bar"[^>]* aria-hidden="true"/);
		expect(svg).not.toContain("role=");
	});

	it("fills the bar by the share of the threshold, up to full", () => {
		expect(widthOf(thresholdBars(100, 250, null).value)).toBe(40);
		expect(widthOf(thresholdBars(0, 250, null).value)).toBe(0);
		expect(widthOf(thresholdBars(300, 250, null).value)).toBe(100);
	});

	it("ticks the even pace only when there is one", () => {
		expect(tickOf(thresholdBars(100, 250, 138).value)).toBe("55.2");
		expect(thresholdBars(100, 250, null).value).not.toContain("pace-mark");
	});
});
