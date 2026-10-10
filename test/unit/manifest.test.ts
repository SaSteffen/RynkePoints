import { describe, expect, it } from "vitest";

// The web app manifest (feature 010 contracts/client.md, research R1; FR-001,
// FR-002, FR-032). It is a static asset, so the test reads the file itself.
// `import.meta.glob` is declared in dev-guard.test.ts.

const FILES = import.meta.glob("../../public/manifest.webmanifest", {
	query: "?raw",
	import: "default",
	eager: true,
});

const manifest = JSON.parse(Object.values(FILES)[0] ?? "null");

describe("manifest.webmanifest", () => {
	it("names the app RynkePoints in every field (FR-032)", () => {
		expect(manifest.name).toBe("RynkePoints");
		expect(manifest.short_name).toBe("RynkePoints");
		expect(manifest.description).toBe("RynkePoints");
	});

	it("opens the rider page in its own window, light (FR-001, FR-002, 011 R12)", () => {
		expect(manifest.id).toBe("/");
		expect(manifest.scope).toBe("/");
		expect(manifest.start_url).toBe("/team");
		expect(manifest.display).toBe("standalone");
		expect(manifest.theme_color).toBe("#fffdf5");
		expect(manifest.background_color).toBe("#fffdf5");
	});

	it("lists the 192, 512 and maskable icons", () => {
		expect(manifest.icons).toEqual([
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
			{
				src: "/icons/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		]);
	});

	it("has no other fields", () => {
		expect(Object.keys(manifest).sort()).toEqual(
			[
				"id",
				"name",
				"short_name",
				"description",
				"start_url",
				"scope",
				"display",
				"theme_color",
				"background_color",
				"icons",
			].sort(),
		);
	});
});
