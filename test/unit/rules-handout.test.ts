import { describe, expect, it } from "vitest";
import { currentRules } from "../../src/rynke/rules";
import { TEAMS } from "../../src/teams";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";

// Every team's rider page links to its own handout PDF (feature 005 FR-053,
// feature 026 FR-022), a static asset from `pnpm docs:pdf`, so the test reads
// the files themselves. Their content is checked by hand (feature 003 FR-018).
// `import.meta.glob` is declared in dev-guard.test.ts.

const FILES = import.meta.glob("../../public/**/*.pdf", {
	query: "?raw",
	import: "default",
	eager: true,
});

// The bracket keeps it a glob: Vite's crawler fails on this plain path.
const HEADERS = import.meta.glob("../../public/_header[s]", {
	query: "?raw",
	import: "default",
	eager: true,
});

describe.each(TEAMS)("rules handout of $id", (team) => {
	const { path } = team.rulesHandout;

	it("links to a PDF the app serves", () => {
		const pdf = FILES[`../../public${path}`];
		expect(pdf?.startsWith("%PDF-")).toBe(true);
	});

	it("serves it as a download (research R14)", () => {
		const name = path.slice(path.lastIndexOf("/") + 1);
		expect(HEADERS["../../public/_headers"]).toContain(
			`${path}\n  Content-Disposition: attachment; filename="${name}"`,
		);
	});
});

// The handouts' Markdown, the source of the PDFs (feature 039 research R12):
// Europe's states its minimum ride length, Hamburg's has none.
const HANDOUTS = import.meta.glob("../../docs/**/rynke-p*.md", {
	query: "?raw",
	import: "default",
	eager: true,
});

describe("minimum ride length in the handouts (feature 039)", () => {
	it("Europe's states the outdoor and virtual minimums with their examples", () => {
		const text = HANDOUTS["../../docs/teams/europe/rynke-points.md"];
		expect(currentRules(europe.rules).distanceMinKm).toEqual({
			outdoor: 25,
			virtual: 1,
		});
		expect(text).toContain("at least **25 km**");
		expect(text).toContain("at least **1 km**");
		expect(text).toMatch(/24\.9 km outdoors +\| +0 \|/);
		expect(text).toMatch(/\| 25 km outdoors +\| +2 \|/);
		expect(text).toMatch(/\| 15 km virtual +\| +1 \|/);
		expect(text).not.toContain("not even for its elevation");
	});

	it("Europe's names the higher speed limit for virtual rides", () => {
		const text = HANDOUTS["../../docs/teams/europe/rynke-points.md"];
		expect(currentRules(europe.rules).virtualMaxSpeedKmh).toBe(60);
		expect(text).toContain("**above 45 km/h**");
		expect(text).toContain("up to **60 km/h**");
	});

	it("Hamburg's names no minimum ride length", () => {
		const text = HANDOUTS["../../docs/rynke-punkte.md"];
		expect(text).toBeDefined();
		expect(text).not.toMatch(/mindestens \*\*\d+ km\*\*|Mindestlänge/);
	});
});

// Research R15: each handout names its team's Training Rynke needed from
// outside virtual rides.
describe("Training Rynke from outside virtual rides in the handouts (feature 039)", () => {
	it("Europe's names its 84", () => {
		const text = HANDOUTS["../../docs/teams/europe/rynke-points.md"];
		expect(currentRules(europe.rules).minOutsideTraining).toBe(84);
		expect(text).toContain("at least **84 Training\nRynke**");
		expect(text).not.toContain("167");
		expect(text).not.toContain("at most one third");
	});

	it("Hamburg's still names its 167", () => {
		const text = HANDOUTS["../../docs/rynke-punkte.md"];
		expect(currentRules(hamburg.rules).minOutsideTraining).toBe(167);
		expect(text).toContain("Mindestens **167 Trainingsrynke**");
	});
});
