import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";
import { snapshot } from "../support/rynke";

// The Rynke sections of /me (feature 005 contracts/rider-page.md), one test per
// scenario of the spec's User Story 1. German text, as messages.md quotes it.

const ctx = makeCtx();
let fake: FakeStrava;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx.queue.sent.length = 0;
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

afterEach(() => fake.restore());

/** The inner HTML of the first `<section>` whose opening tag matches `attr`. */
function section(page: string, attr: string): string | null {
	const pattern = new RegExp(
		`<section[^>]*${attr}[^>]*>([\\s\\S]*?)</section>`,
	);
	return page.match(pattern)?.[1] ?? null;
}

function text(fragment: string): string {
	return fragment
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** The cell texts of the ride table's main rows. */
function mainRows(page: string): string[][] {
	return [...page.matchAll(/<tr class="ride [^"]*">([\s\S]*?)<\/tr>/g)].map(
		(row) =>
			[...(row[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
				text(c[1] ?? ""),
			),
	);
}

async function summary(athleteId = ATHLETE_A): Promise<string> {
	const { html } = await riderPage(ctx, athleteId);
	const found = section(html, 'class="rynke-summary"');
	if (found === null) throw new Error("no summary section");
	return text(found);
}

describe("GET /me Rynke summary (US1)", () => {
	it("S1-1: shows what is missing of both targets", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 12,
			trainingRynke: 12,
			trainingMissing: 238,
			trainingWithoutVirtual: 12,
			virtualShareMissing: 155,
		});
		const shown = await summary();
		expect(shown).toContain("Noch nicht dabei. Dir fehlen:");
		expect(shown).toContain("12 von 250");
		expect(shown).toContain("238 fehlen noch");
		expect(shown).toContain("0 von 25");
		expect(shown).toContain("25 fehlen noch");
		expect(shown).toContain("238 Trainingsrynke");
		expect(shown).toContain("25 Teamrynke");
		expect(shown).not.toContain("Du bist dabei");
	});

	it("S1-2: says the rider is in, without a line for virtual rides", async () => {
		await seedBalance(ATHLETE_A, {
			trainingRynke: 262,
			trainingMissing: 0,
			teamRynke: 25,
			teamMissing: 0,
			trainingWithoutVirtual: 262,
			virtualShareMissing: 0,
			qualified: true,
		});
		const { html } = await riderPage(ctx, ATHLETE_A);
		const shown = text(section(html, 'class="rynke-summary"') ?? "");
		expect(shown).toContain(
			"Du bist dabei: Du hast alles, was du für die Tour brauchst.",
		);
		expect(shown).toContain("262 von 250");
		expect(shown).toContain("25 von 25");
		expect(shown.match(/erreicht ✓/g)).toHaveLength(2);
		expect(shown).not.toContain("Trainingsrynke ohne virtuelle Fahrten");
		expect(html).not.toContain('class="rynke-missing"');
	});

	it("S1-3: names what is missing without virtual rides", async () => {
		await seedBalance(ATHLETE_A, {
			trainingRynke: 262,
			trainingMissing: 0,
			teamRynke: 25,
			teamMissing: 0,
			trainingWithoutVirtual: 160,
			virtualShareMissing: 7,
		});
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			sport_type: "VirtualRide",
			result: { counts: true, distanceRynke: 102, isVirtual: true },
		});
		const shown = await summary();
		expect(shown).toContain("Trainingsrynke ohne virtuelle Fahrten");
		expect(shown).toContain("160 von 167");
		expect(shown).toContain(
			"7 Trainingsrynke aus Fahrten draußen (nicht virtuell)",
		);
		expect(shown).toContain("Noch nicht dabei");
	});

	it("S1-4: names only the missing Team Rynke", async () => {
		await seedBalance(ATHLETE_A, {
			trainingRynke: 400,
			trainingMissing: 0,
			teamRynke: 20,
			teamMissing: 5,
			trainingWithoutVirtual: 400,
			virtualShareMissing: 0,
		});
		const { html } = await riderPage(ctx, ATHLETE_A);
		const missing = html.match(
			/<ul class="rynke-missing">([\s\S]*?)<\/ul>/,
		)?.[1];
		expect(
			[...(missing ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]),
		).toEqual(["5 Teamrynke"]);
		expect(text(html)).toContain("400 von 250");
	});

	it("S1-9: shows only a notice before the first evaluation", async () => {
		await seedRide(ATHLETE_A, { id: 8_100_001 });
		const { html } = await riderPage(ctx, ATHLETE_A);
		const notice = section(html, 'class="notice" role="status"');
		expect(text(notice ?? "")).toBe(
			"Deine Rynke werden gerade berechnet. Schau in ein paar Minuten wieder vorbei.",
		);
		expect(html).not.toContain('class="rynke-summary"');
		expect(html).not.toContain("von 250");
		expect(html).not.toContain("dabei");
		expect(section(html, 'id="rides"')).not.toBeNull();
	});
});

describe("GET /me ride table (US1)", () => {
	beforeEach(() => seedBalance(ATHLETE_A));

	it("S1-6: shows a counting ride's Rynke and metres", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-06T08:00:00Z",
			distance_m: 79000,
			elevation_gain_m: 1240,
			result: { counts: true, distanceRynke: 7, elevationDm: 12400 },
		});
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(mainRows(html)).toEqual([
			["06.10.2026", "79,0 km", "zählt", "7", "1.240 m"],
		]);
		expect(html).toContain('<tr class="ride ride-counting">');
		// No elevation Rynke per ride, anywhere (FR-040).
		const details = html.match(/<tr class="ride-details">([\s\S]*?)<\/tr>/);
		expect(text(details?.[1] ?? "")).toBe("Radfahrt · 1.240 m");
	});

	it("S1-7: shows a ride that doesn't count with nothing", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-05T08:00:00Z",
			distance_m: 30000,
			result: { counts: false, reasons: ["too_slow"] },
		});
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(mainRows(html)).toEqual([
			["05.10.2026", "30,0 km", "zählt nicht", "0", "0 m"],
		]);
		expect(html).toContain('<tr class="ride ride-not-counting">');
	});

	it("S1-8: shows a ride without a result as being evaluated", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-04T08:00:00Z",
			distance_m: 40000,
		});
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(mainRows(html)).toEqual([
			["04.10.2026", "40,0 km", "wird ausgewertet", "–", "–"],
		]);
		expect(html).toContain('<tr class="ride ride-pending">');
	});

	it("marks a virtual ride in its details", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			sport_type: "VirtualRide",
			elevation_gain_m: 300,
			result: {
				counts: true,
				distanceRynke: 4,
				elevationDm: 3000,
				isVirtual: true,
			},
		});
		const { html } = await riderPage(ctx, ATHLETE_A);
		const details = html.match(/<tr class="ride-details">([\s\S]*?)<\/tr>/);
		expect(text(details?.[1] ?? "")).toBe("Virtuelle Fahrt · 300 m · virtuell");
	});

	it("labels the columns", async () => {
		await seedRide(ATHLETE_A, { id: 8_100_001 });
		const { html } = await riderPage(ctx, ATHLETE_A);
		const head = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? "";
		expect(
			[...head.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => m[1]),
		).toEqual([
			"Datum",
			"Distanz",
			"Zählt?",
			"Trainingsrynke",
			"Für die Höhenmeter",
		]);
	});
});

describe("GET /me isolation and access (US1)", () => {
	it("S1-10: shows each rider only their own figures", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await seedBalance(ATHLETE_A, { trainingRynke: 111, trainingMissing: 139 });
		await seedBalance(ATHLETE_B, { trainingRynke: 222, trainingMissing: 28 });
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			distance_m: 51000,
			result: { counts: true, distanceRynke: 5 },
		});
		await seedRide(ATHLETE_B, {
			id: 8_200_001,
			distance_m: 93000,
			result: { counts: true, distanceRynke: 9 },
		});

		const a = text((await riderPage(ctx, ATHLETE_A)).html);
		expect(a).toContain("111 von 250");
		expect(a).toContain("51,0 km");
		expect(a).not.toContain("222 von");
		expect(a).not.toContain("93,0 km");

		const b = text((await riderPage(ctx, ATHLETE_B)).html);
		expect(b).toContain("222 von 250");
		expect(b).toContain("93,0 km");
		expect(b).not.toContain("111 von");
		expect(b).not.toContain("51,0 km");
	});

	it("S1-11: sends a signed-out visitor to the start page", async () => {
		const res = await handleFetch(request("/me"), ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("SC-004: only reads", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 12, trainingMissing: 238 });
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			result: { counts: true, distanceRynke: 4 },
		});
		await seedRide(ATHLETE_A, { id: 8_100_002 });
		const counts = await tableCounts();
		const rows = await snapshot(ATHLETE_A);

		expect((await riderPage(ctx, ATHLETE_A)).status).toBe(200);

		expect(await tableCounts()).toEqual(counts);
		expect(await snapshot(ATHLETE_A)).toEqual(rows);
		expect(ctx.queue.sent).toEqual([]);
		expect(fake.calls).toEqual([]);
	});

	it("places the sections after the import status, before consent", async () => {
		await seedBalance(ATHLETE_A);
		await seedRide(ATHLETE_A, { id: 8_100_001 });
		const { html } = await riderPage(ctx, ATHLETE_A);
		const order = [
			"<p>Import abgeschlossen</p>",
			'<section id="rynke" class="rynke-summary">',
			'<section id="rides">',
			"<h2>Deine Zustimmung</h2>",
		].map((marker) => html.indexOf(marker));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((x, y) => x - y)).toEqual(order);
	});
});
