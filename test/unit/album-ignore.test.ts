import { describe, expect, it } from "vitest";

// The season albums hold real rider data and must never be committed (feature
// 021 FR-025, research R15). `pnpm season:album` also asks git before writing.

const GITIGNORE = import.meta.glob("../../.gitignore", {
	query: "?raw",
	import: "default",
	eager: true,
});

describe(".gitignore", () => {
	it("ignores season-albums/", () => {
		const text = Object.values(GITIGNORE)[0] ?? "";
		const lines = text.split("\n").map((line) => line.trim());
		expect(lines).toContain("season-albums/");
	});
});
