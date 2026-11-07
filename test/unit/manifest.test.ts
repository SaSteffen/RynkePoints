import { describe, expect, it } from "vitest";
import { handleManifest, MANIFEST_PATH } from "../../src/http/pwa";
import { route } from "../../src/http/router";
import { makeCtx } from "../support/ctx";

// The web app manifest (feature 010 contracts/client.md, research R1; FR-001,
// FR-002, FR-032), served from the team's data (feature 026 T050). These are
// the founding team's values, unchanged from the static file it replaced.

const manifest = await handleManifest(makeCtx()).json<
	Record<string, unknown>
>();

describe("manifest.webmanifest", () => {
	it("is served at its address as a manifest", async () => {
		const response = await route(
			new Request(`http://localhost${MANIFEST_PATH}`),
			makeCtx(),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(
			"application/manifest+json",
		);
		expect(await response.json()).toEqual(manifest);
	});

	it("names the app RynkePoints in every field (FR-032)", () => {
		expect(manifest.name).toBe("RynkePoints");
		expect(manifest.short_name).toBe("RynkePoints");
		expect(manifest.description).toBe("RynkePoints");
	});

	it("opens the rider page in its own window, light (FR-001, FR-002, 011 R12)", () => {
		expect(manifest.id).toBe("/");
		expect(manifest.scope).toBe("/");
		expect(manifest.start_url).toBe("/");
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
