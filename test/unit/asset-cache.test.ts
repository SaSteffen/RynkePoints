import { describe, expect, it } from "vitest";
import { artUrl } from "../../src/http/art";

// The static art is cached instead of revalidated on every view (issue
// #182): for good where its address holds the file's hash.
// `import.meta.glob` is declared in dev-guard.test.ts.

// The bracket keeps it a glob: Vite's crawler fails on this plain path.
const HEADERS = import.meta.glob("../../public/_header[s]", {
	query: "?raw",
	import: "default",
	eager: true,
});

const KEPT = "public, max-age=31536000, immutable";
const DAY = "public, max-age=86400, stale-while-revalidate=604800";

describe("static art caching", () => {
	it.each(["/badges/*", "/coin/*", "/illustrations/*", "/quotes/*"])(
		"keeps %s for good: its address holds the file's hash",
		(path) => {
			expect(HEADERS["../../public/_headers"]).toContain(
				`${path}\n  Cache-Control: ${KEPT}`,
			);
		},
	);

	it("caches the icons for a day", () => {
		expect(HEADERS["../../public/_headers"]).toContain(
			`/icons/*\n  Cache-Control: ${DAY}`,
		);
	});
});

describe("artUrl", () => {
	it("adds the picture's hash", () => {
		expect(artUrl("/coin/rynke-coin-front.svg")).toMatch(
			/^\/coin\/rynke-coin-front\.svg\?v=[0-9a-f]{10}$/,
		);
	});

	it("leaves a file the list doesn't know as it is", () => {
		expect(artUrl("/badges/nothing.svg")).toBe("/badges/nothing.svg");
	});
});
