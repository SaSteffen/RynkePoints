import { describe, expect, it } from "vitest";
import { sparkline, thresholdBars, weekBars } from "../../src/http/charts";

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
