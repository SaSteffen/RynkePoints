import { describe, expect, it } from "vitest";
import { RULES_HANDOUT_URL } from "../../src/http/rider-sections";

// The rider page links to the handout PDF (feature 005 FR-053), a static asset
// from `pnpm docs:pdf`, so the test reads the file itself. Its content is
// checked by hand (feature 003 FR-018). `import.meta.glob` is declared in
// dev-guard.test.ts.

const FILES = import.meta.glob("../../public/*.pdf", {
	query: "?raw",
	import: "default",
	eager: true,
});

describe("rules handout", () => {
	it("links to a PDF the app serves", () => {
		const pdf = FILES[`../../public${RULES_HANDOUT_URL}`];
		expect(pdf?.startsWith("%PDF-")).toBe(true);
	});
});
