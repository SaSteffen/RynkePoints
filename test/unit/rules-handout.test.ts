import { describe, expect, it } from "vitest";
import { TEAMS } from "../../src/teams";

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
