import { describe, expect, it } from "vitest";

// The static art is cached for a day instead of revalidated on every view
// (issue #182). `import.meta.glob` is declared in dev-guard.test.ts.

// The bracket keeps it a glob: Vite's crawler fails on this plain path.
const HEADERS = import.meta.glob("../../public/_header[s]", {
	query: "?raw",
	import: "default",
	eager: true,
});

const ART_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

describe("static art caching", () => {
	it.each(["/badges/*", "/coin/*", "/illustrations/*", "/icons/*"])(
		"caches %s for a day",
		(path) => {
			expect(HEADERS["../../public/_headers"]).toContain(
				`${path}\n  Cache-Control: ${ART_CACHE}`,
			);
		},
	);
});
