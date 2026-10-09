import { describe, expect, it } from "vitest";
import { sparkline } from "../../src/http/charts";

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
