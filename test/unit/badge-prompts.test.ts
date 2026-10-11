import { describe, expect, it } from "vitest";
import data from "../../art/badges/badges.json";
import { buildPrompt, validateBadges } from "../../scripts/badge-prompts.mjs";

// The badge art inputs (feature 013 art pipeline, data-model.md): the badge
// list in art/badges/badges.json and how a badge's Gemini prompt is put
// together from the shared template.

type Badge = {
	id: string;
	group: string;
	category: string;
	threshold: number;
	scene: string;
};

const badge = (over: Partial<Badge> = {}): Badge => ({
	id: "distance-100",
	group: "personal",
	category: "distance",
	threshold: 100,
	scene: "Riding. {{bike}}",
	...over,
});

const valid = (badges: Badge[]) => ({
	snippets: { bike: "A yellow bike." },
	badges,
});

describe("validateBadges", () => {
	it("accepts the real badge list", () => {
		expect(validateBadges(data)).toEqual([]);
	});

	it("accepts a well-formed list", () => {
		expect(
			validateBadges(
				valid([badge(), badge({ id: "distance-500", threshold: 500 })]),
			),
		).toEqual([]);
	});

	it("rejects duplicate ids", () => {
		const problems = validateBadges(
			valid([badge(), badge({ threshold: 500 })]),
		);
		expect(problems.join("\n")).toMatch(/distance-100.*duplicate/);
	});

	it("rejects ids that are not lower-case words joined by dashes", () => {
		for (const id of ["Distance-100", "distance_100", "-x", "x-", "a--b", ""]) {
			expect(validateBadges(valid([badge({ id })])).length).toBeGreaterThan(0);
		}
	});

	it("rejects ids ending in -ribbon, the name of a badge's ribbon file", () => {
		expect(
			validateBadges(valid([badge({ id: "distance-ribbon" })])).join("\n"),
		).toMatch(/ribbon/);
	});

	it("rejects an unknown group", () => {
		expect(
			validateBadges(valid([badge({ group: "club" })])).join("\n"),
		).toMatch(/group/);
	});

	it("rejects thresholds that are not above 0", () => {
		for (const threshold of [0, -5, Number.NaN]) {
			expect(validateBadges(valid([badge({ threshold })])).join("\n")).toMatch(
				/threshold/,
			);
		}
	});

	it("rejects thresholds that don't increase within a category", () => {
		const problems = validateBadges(
			valid([
				badge({ id: "distance-500", threshold: 500 }),
				badge({ id: "distance-100", threshold: 100 }),
			]),
		);
		expect(problems.join("\n")).toMatch(/distance.*increas/);
	});

	it("rejects a category in both groups", () => {
		const problems = validateBadges(
			valid([
				badge(),
				badge({ id: "distance-500", threshold: 500, group: "team" }),
			]),
		);
		expect(problems.join("\n")).toMatch(/distance.*group/);
	});

	it("rejects an empty scene, an unknown snippet and {{scene}}", () => {
		expect(validateBadges(valid([badge({ scene: " " })])).length).toBe(1);
		expect(
			validateBadges(valid([badge({ scene: "{{boat}}" })])).join("\n"),
		).toMatch(/boat/);
		expect(
			validateBadges(valid([badge({ scene: "x {{scene}}" })])).length,
		).toBe(1);
	});

	it("rejects data without a badge list", () => {
		expect(validateBadges({ snippets: {} }).length).toBeGreaterThan(0);
	});
});

describe("buildPrompt", () => {
	const template = "Before.\n\nScene: {{scene}}\n\nAfter.";
	const snippets = { bike: "A yellow bike.", team: "Many of him." };

	it("fills the scene into the template, snippets expanded", () => {
		expect(
			buildPrompt(template, snippets, badge({ scene: "Go. {{bike}}" })),
		).toBe("Before.\n\nScene: Go. A yellow bike.\n\nAfter.");
	});

	it("expands several snippets, also the same one twice", () => {
		expect(
			buildPrompt(
				template,
				snippets,
				badge({ scene: "{{team}} {{bike}} {{bike}}" }),
			),
		).toContain("Many of him. A yellow bike. A yellow bike.");
	});

	it("throws on an unknown snippet", () => {
		expect(() =>
			buildPrompt(template, snippets, badge({ scene: "{{boat}}" })),
		).toThrow(/distance-100.*boat/);
	});

	it("throws when the template has no {{scene}}", () => {
		expect(() => buildPrompt("No place.", snippets, badge())).toThrow(/scene/);
	});

	it("builds a self-contained prompt for every real badge", () => {
		const real = data as {
			snippets: Record<string, string>;
			badges: Badge[];
		};
		for (const b of real.badges) {
			const prompt = buildPrompt(template, real.snippets, b);
			expect(prompt).not.toMatch(/{{\w+}}/);
		}
	});
});
