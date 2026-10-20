import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { type AlbumFiles, handleAlbumRequest } from "../../album/routes";
import { ALBUM_CSS } from "../../album/style";
import { makeCtx, resetDb, seedRider, tableCounts } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";

// The local album Worker's routes (feature 021 US3,
// contracts/album-worker.md). Synthetic riders only.

const ctx = makeCtx();
const NOT_LISTED = 900004;
const FILES: AlbumFiles = {
	fonts: { "Nunito-Regular.woff2": new Uint8Array([1, 2, 3]).buffer },
};

function get(path: string, host = "127.0.0.1:8798"): Promise<Response> {
	return handleAlbumRequest(
		new Request(`http://${host}${path}`),
		env,
		FILES,
		() => NOW,
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Ben" });
	await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Anna" });
	await seedRider(ctx, { athleteId: ATHLETE_C, firstName: "ben" });
	await seedRider(ctx, {
		athleteId: NOT_LISTED,
		firstName: "Cleo",
		consentVersion: null,
	});
});

describe("GET /riders", () => {
	it("lists exactly the listed riders with their file stems", async () => {
		const res = await get("/riders?cutoff=2026-10-06");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([
			{ athleteId: ATHLETE_A, file: "anna-1" },
			{ athleteId: ATHLETE_B, file: "ben-1" },
			{ athleteId: ATHLETE_C, file: "ben-2" },
		]);
	});

	it.each(["", "?cutoff=", "?cutoff=2026-02-30", "?cutoff=6.10.2026"])(
		"answers 400 to %j",
		async (query) => {
			expect((await get(`/riders${query}`)).status).toBe(400);
		},
	);
});

describe("GET /album/:athleteId", () => {
	it("answers a listed rider's album as HTML", async () => {
		const res = await get(`/album/${ATHLETE_A}?cutoff=2026-10-06`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
		const text = await res.text();
		expect(text).toContain('<section class="page');
		expect(text).toContain("Anna");
	});

	it("answers 404 for a rider who is not listed", async () => {
		expect((await get(`/album/${NOT_LISTED}?cutoff=2026-10-06`)).status).toBe(
			404,
		);
		expect((await get("/album/123456?cutoff=2026-10-06")).status).toBe(404);
		expect((await get("/album/abc?cutoff=2026-10-06")).status).toBe(404);
	});

	it("answers 400 without a valid cut-off", async () => {
		expect((await get(`/album/${ATHLETE_A}`)).status).toBe(400);
		expect((await get(`/album/${ATHLETE_A}?cutoff=2026-13-01`)).status).toBe(
			400,
		);
	});
});

describe("the album's files", () => {
	it("serves the stylesheet and the fonts", async () => {
		const css = await get("/album.css");
		expect(css.status).toBe(200);
		expect(css.headers.get("Content-Type")).toMatch(/^text\/css/);
		expect(await css.text()).toBe(ALBUM_CSS);
		const font = await get("/fonts/Nunito-Regular.woff2");
		expect(font.status).toBe(200);
		expect(font.headers.get("Content-Type")).toBe("font/woff2");
		expect((await get("/fonts/Other.woff2")).status).toBe(404);
	});
});

describe("anything else", () => {
	it.each(["/", "/me", "/riders/x", "/album"])(
		"answers 404 to %s",
		async (path) => {
			expect((await get(path)).status).toBe(404);
		},
	);

	it.each(["rynke.example", "trhh-rynke-coins.link", "192.168.1.5:8798"])(
		"answers 404 to host %s",
		async (host) => {
			expect((await get("/riders?cutoff=2026-10-06", host)).status).toBe(404);
			expect((await get("/album.css", host)).status).toBe(404);
		},
	);

	it("serves localhost too", async () => {
		expect((await get("/album.css", "localhost:8798")).status).toBe(200);
	});

	it("writes nothing", async () => {
		const before = await tableCounts();
		await get("/riders?cutoff=2026-10-06");
		await get(`/album/${ATHLETE_A}?cutoff=2026-10-06`);
		await get(`/album/${ATHLETE_B}?cutoff=2026-10-06`);
		expect(await tableCounts()).toEqual(before);
	});
});
