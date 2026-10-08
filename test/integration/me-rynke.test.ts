import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RIDE_PAGE_SQL } from "../../src/db/rider-view";
import { RULES_HANDOUT_URL } from "../../src/http/rider-sections";
import { handleFetch } from "../../src/index";
import type { ReasonCode } from "../../src/rynke/rides";
import { CURRENT_RULES } from "../../src/rynke/rules";
import type { TeamEventSum } from "../../src/rynke/team-events";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import {
	rideCards,
	riderPage,
	type SeedRide,
	seedBalance,
	seedRide,
	seedRides,
} from "../support/rider-view";
import {
	attendanceRows,
	attendRaw,
	insertEvent,
	snapshot,
} from "../support/rynke";

// The Rynke sections of /me (feature 005 contracts/rider-page.md), one test per
// scenario of the spec's User Stories 1 to 6. German text, as messages.md quotes it.

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

/** Each ride card's date, distance, status, Training Rynke and elevation. */
function mainRows(page: string): string[][] {
	return rideCards(page).map((card) => card.cells);
}

async function summary(athleteId = ATHLETE_A): Promise<string> {
	const { html } = await riderPage(ctx, athleteId);
	const found = section(html, 'class="rynke-summary verdict card"');
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
		const shown = text(
			section(html, 'class="rynke-summary verdict card"') ?? "",
		);
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
			[
				...(missing ?? "").matchAll(
					/<li><span class="chip">([\s\S]*?)<\/span><\/li>/g,
				),
			].map((m) => m[1]),
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
		expect(html).not.toContain('class="rynke-summary verdict card"');
		expect(html).not.toContain("von 250");
		expect(html).not.toContain("dabei");
		expect(section(html, 'id="rides"')).toBeNull();
		const rides = (await riderPage(ctx, ATHLETE_A, "/me/rides")).html;
		expect(section(rides, 'id="rides"')).not.toBeNull();
	});
});

/** Each gauge's classes, caption text, bar and legend items. */
async function gauges(athleteId = ATHLETE_A) {
	const { html } = await riderPage(ctx, athleteId);
	return [
		...html.matchAll(/<figure class="([^"]*)">([\s\S]*?)<\/figure>/g),
	].map(([, classes, inner = ""]) => ({
		classes,
		caption: text(
			inner.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1] ?? "",
		),
		bar: inner.match(/<div class="gauge-bar"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "",
		legend: [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
			text(m[1] ?? ""),
		),
	}));
}

describe("GET /me gauges (US2)", () => {
	it("S2-1: captions each gauge with its figures and percentage", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 12,
			trainingRynke: 12,
			trainingMissing: 238,
			trainingWithoutVirtual: 12,
			virtualShareMissing: 155,
		});
		const [training, team, elevation, ...rest] = await gauges();
		expect(training?.caption).toBe("Trainingsrynke: 12 von 250 · 4 %");
		expect(team?.caption).toBe("Teamrynke: 0 von 25 · 0 %");
		expect(elevation?.caption).toContain("Höhenmeter bis zu den nächsten 5");
		expect(rest).toEqual([]);
		expect(training?.classes).toBe("gauge");
		expect(training?.bar).toContain(
			'<span class="gauge-part gauge-part-1" style="width:4.80%"></span>',
		);
		expect(team?.bar).toContain('<span class="gauge-fill" style="width:0%">');
		expect(team?.legend).toEqual([]);
	});

	it("S2-2: is not reached one Rynke short", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 249,
			trainingRynke: 249,
			trainingMissing: 1,
		});
		const [training] = await gauges();
		expect(training?.caption).toBe("Trainingsrynke: 249 von 250 · 99 %");
		expect(training?.classes).toBe("gauge");
	});

	it("S2-3: is reached above the target", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 200,
			elevationRynke: 62,
			trainingRynke: 262,
			trainingMissing: 0,
		});
		const [training] = await gauges();
		expect(training?.caption).toBe(
			"Trainingsrynke: 262 von 250 · 100 % · ✓ erreicht",
		);
		expect(training?.classes).toBe("gauge gauge-reached");
	});

	it("S2-4: fills the share without virtual rides", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 262,
			trainingRynke: 262,
			trainingMissing: 0,
			trainingWithoutVirtual: 160,
			virtualShareMissing: 7,
		});
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			sport_type: "VirtualRide",
			result: { counts: true, distanceRynke: 102, isVirtual: true },
		});
		const shown = await gauges();
		expect(shown).toHaveLength(4);
		expect(shown[2]?.caption).toBe(
			"Trainingsrynke ohne virtuelle Fahrten: 160 von 167 · 95 %",
		);
	});

	it("S2-5: shows the metres towards the next elevation step", async () => {
		await seedBalance(ATHLETE_A, {
			elevationDm: 12400,
			elevationRynke: 5,
			elevationToNextStepDm: 7600,
			trainingRynke: 5,
			trainingMissing: 245,
		});
		const elevation = (await gauges()).at(-1);
		expect(elevation?.caption).toBe(
			"Höhenmeter bis zu den nächsten 5 Trainingsrynke: 240 m von 1.000 m · 24 % · noch 760 m",
		);
		expect(elevation?.bar).toContain('style="width:24%"');
	});

	it("S2-8: shows every gauge reached for a rider who is in", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 262,
			trainingRynke: 262,
			trainingMissing: 0,
			teamRynke: 25,
			teamMissing: 0,
			trainingWithoutVirtual: 262,
			virtualShareMissing: 0,
			qualified: true,
		});
		const [training, team] = await gauges();
		expect(training?.classes).toBe("gauge gauge-reached");
		expect(team?.classes).toBe("gauge gauge-reached");
		expect(team?.caption).toBe("Teamrynke: 25 von 25 · 100 % · ✓ erreicht");
		expect(await summary()).toContain("Du bist dabei");
	});

	it("S2-9: tells everything in text, beside a hidden bar", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 70,
			elevationRynke: 30,
			trainingRynke: 100,
			trainingMissing: 150,
		});
		const shown = await gauges();
		for (const gauge of shown) {
			expect(gauge.bar).toMatch(/^<div class="gauge-bar" aria-hidden="true">/);
		}
		const [training] = shown;
		expect(training?.legend).toEqual(["Distanz: 70", "Höhenmeter: 30"]);
		expect(training?.bar).toContain(
			'class="gauge-part gauge-part-1" style="width:28.00%"',
		);
		expect(training?.bar).toContain(
			'class="gauge-part gauge-part-2" style="width:12.00%"',
		);
	});

	it("places the gauges right after the summary", async () => {
		await seedBalance(ATHLETE_A);
		const { html } = await riderPage(ctx, ATHLETE_A);
		const order = [
			'<section id="rynke" class="rynke-summary verdict card">',
			'<section class="rynke-gauges">',
			'<section class="rynke-breakdown card card-outlined">',
		].map((marker) => html.indexOf(marker));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((x, y) => x - y)).toEqual(order);
		expect(text(section(html, 'class="rynke-gauges"') ?? "")).toMatch(
			/^Dein Fortschritt /,
		);
	});

	it("has no gauges before the first evaluation", async () => {
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(html).not.toContain('class="rynke-gauges"');
	});

	it("has no gauges for an unknown rules version (FR-013)", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 12, rulesVersion: 99 });
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(html).toContain('class="rynke-summary verdict card"');
		expect(html).not.toContain('class="rynke-gauges"');
	});
});

/** The breakdown's term and description texts, as `[dt, dd]` pairs. */
async function breakdown(athleteId = ATHLETE_A): Promise<string[][]> {
	const { html } = await riderPage(ctx, athleteId);
	const found = section(html, 'class="rynke-breakdown card card-outlined"');
	if (found === null) throw new Error("no breakdown section");
	return [...found.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map(
		([, dt = "", dd = ""]) => [text(dt), text(dd)],
	);
}

describe("GET /me breakdown (US3a)", () => {
	it("S3-1: shows distance, elevation and the total", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 7,
			elevationDm: 12400,
			elevationRynke: 5,
			elevationToNextStepDm: 7600,
			trainingRynke: 12,
			trainingMissing: 238,
			trainingWithoutVirtual: 12,
			virtualShareMissing: 155,
		});
		expect(await breakdown()).toEqual([
			["Distanz", "7 Trainingsrynke"],
			[
				"Höhenmeter",
				"1.240 m gesamt → 5 Trainingsrynke, noch 760 m bis zu den nächsten 5",
			],
			["Teamtraining", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Tag Trainingswochenende", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Techniktraining", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Gesamt", "12 Trainingsrynke · 0 Teamrynke"],
		]);
	});

	it("S3-4: gives 15 Training Rynke for 3000 m", async () => {
		await seedBalance(ATHLETE_A, {
			elevationDm: 30000,
			elevationRynke: 15,
			elevationToNextStepDm: 10000,
			trainingRynke: 15,
			trainingMissing: 235,
		});
		expect((await breakdown())[1]).toEqual([
			"Höhenmeter",
			"3.000 m gesamt → 15 Trainingsrynke, noch 1.000 m bis zu den nächsten 5",
		]);
	});

	it("S3-5: shows 0 everywhere for a rider without rides", async () => {
		await seedBalance(ATHLETE_A);
		expect(await breakdown()).toEqual([
			["Distanz", "0 Trainingsrynke"],
			[
				"Höhenmeter",
				"0 m gesamt → 0 Trainingsrynke, noch 1.000 m bis zu den nächsten 5",
			],
			["Teamtraining", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Tag Trainingswochenende", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Techniktraining", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Gesamt", "0 Trainingsrynke · 0 Teamrynke"],
		]);
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(
			text(section(html, 'class="rynke-breakdown card card-outlined"') ?? ""),
		).toContain(
			"Deine Teamtermine Für dich ist noch kein Teamtermin eingetragen.",
		);
		expect(html).not.toContain('class="rynke-events"');
	});

	it("names no step for an unknown rules version (FR-013)", async () => {
		await seedBalance(ATHLETE_A, {
			elevationDm: 12400,
			elevationRynke: 5,
			elevationToNextStepDm: 7600,
			rulesVersion: 99,
		});
		expect((await breakdown())[1]).toEqual([
			"Höhenmeter",
			"1.240 m gesamt → 5 Trainingsrynke, noch 760 m bis zur nächsten Stufe",
		]);
	});

	it("follows the gauges, or the summary without them", async () => {
		await seedBalance(ATHLETE_A);
		const { html } = await riderPage(ctx, ATHLETE_A);
		const order = [
			'<section class="rynke-gauges">',
			'<section class="rynke-breakdown card card-outlined">',
			'<section class="rynke-rules card card-outlined">',
		].map((marker) => html.indexOf(marker));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((x, y) => x - y)).toEqual(order);
		expect(
			text(section(html, 'class="rynke-breakdown card card-outlined"') ?? ""),
		).toMatch(/^Woher deine Rynke kommen /);

		await seedBalance(ATHLETE_A, { rulesVersion: 99 });
		const unknown = (await riderPage(ctx, ATHLETE_A)).html;
		const summaryEnd = unknown.indexOf(
			"</section>",
			unknown.indexOf('<section id="rynke"'),
		);
		const breakdownStart = unknown.indexOf(
			'<section class="rynke-breakdown card card-outlined">',
		);
		expect(summaryEnd).toBeGreaterThan(0);
		expect(
			unknown.slice(summaryEnd + "</section>".length, breakdownStart),
		).toMatch(/^\s*$/);
	});

	it("has no breakdown before the first evaluation", async () => {
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(html).not.toContain(
			'<section class="rynke-breakdown card card-outlined">',
		);
	});
});

/** Stored per-kind sums in `TEAM_EVENT_KINDS` order: `[attended, team, training]`. */
function kindSums(
	teamTraining: [number, number, number],
	weekendDay: [number, number, number],
	technique: [number, number, number],
): TeamEventSum[] {
	return (
		[
			["team_training", teamTraining],
			["training_weekend_day", weekendDay],
			["technique_training", technique],
		] as const
	).map(([kind, [attended, team, training]]) => ({
		kind,
		attended,
		team,
		training,
	}));
}

/** The event list's items: classes and text. */
async function events(athleteId = ATHLETE_A, acceptLanguage?: string) {
	const { html } = await riderPage(ctx, athleteId, "/me", acceptLanguage);
	const list = html.match(/<ul class="rynke-events">([\s\S]*?)<\/ul>/)?.[1];
	return [
		...(list ?? "").matchAll(/<li( class="[^"]*")?>([\s\S]*?)<\/li>/g),
	].map(([, classes, inner = ""]) => ({
		classes: classes ?? "",
		text: text(inner),
	}));
}

describe("GET /me team events (US3b)", () => {
	it("S3-2: shows each kind's count and Rynke", async () => {
		await seedBalance(ATHLETE_A, {
			teamRynke: 7,
			teamMissing: 18,
			trainingRynke: 15,
			trainingMissing: 235,
			trainingWithoutVirtual: 15,
			virtualShareMissing: 152,
			teamEvents: kindSums([2, 2, 10], [0, 0, 0], [1, 5, 5]),
		});
		expect((await breakdown()).slice(2)).toEqual([
			["Teamtraining", "2 × dabei → 2 Teamrynke, 10 Trainingsrynke"],
			["Tag Trainingswochenende", "0 × dabei → 0 Teamrynke, 0 Trainingsrynke"],
			["Techniktraining", "1 × dabei → 5 Teamrynke, 5 Trainingsrynke"],
			["Gesamt", "15 Trainingsrynke · 7 Teamrynke"],
		]);
	});

	it("S3-3: lists the rider's events with date, kind and name, newest first", async () => {
		await seedBalance(ATHLETE_A);
		await seedRider(ctx, { athleteId: ATHLETE_B });
		const teamTraining = await insertEvent("team_training", "2026-04-28");
		const named = await insertEvent(
			"team_training",
			"2026-05-12",
			"Ausfahrt Nord",
		);
		const technique = await insertEvent(
			"technique_training",
			"2026-06-02",
			"Kurven <links> & rechts",
		);
		const otherRider = await insertEvent("training_weekend_day", "2026-07-04");
		await attendRaw(teamTraining, [ATHLETE_A]);
		await attendRaw(named, [ATHLETE_A, ATHLETE_B]);
		await attendRaw(technique, [ATHLETE_A]);
		await attendRaw(otherRider, [ATHLETE_B]);

		expect(await events()).toEqual([
			{
				classes: "",
				text: "02.06.2026 · Techniktraining · Kurven &lt;links&gt; &amp; rechts",
			},
			{ classes: "", text: "12.05.2026 · Teamtraining · Ausfahrt Nord" },
			{ classes: "", text: "28.04.2026 · Teamtraining" },
		]);
		const { html } = await riderPage(ctx, ATHLETE_A);
		expect(html).toContain("Kurven &lt;links&gt; &amp; rechts");
		expect(
			text(section(html, 'class="rynke-breakdown card card-outlined"') ?? ""),
		).toContain("Deine Teamtermine");
		expect(html).not.toContain("noch kein Teamtermin");
	});

	it("FR-033: marks an event outside the counting window as not counting", async () => {
		// No stored rules version has a deadline, so the season start stands in;
		// the deadline is covered by rider-view.test.ts.
		await seedBalance(ATHLETE_A);
		await attendRaw(await insertEvent("technique_training", "2025-12-20"), [
			ATHLETE_A,
		]);
		await attendRaw(await insertEvent("team_training", "2026-01-01"), [
			ATHLETE_A,
		]);
		expect(await events()).toEqual([
			{ classes: "", text: "01.01.2026 · Teamtraining" },
			{
				classes: ' class="event-not-counting"',
				text: "20.12.2025 · Techniktraining · zählt nicht: außerhalb des Wertungszeitraums",
			},
		]);
	});

	it("S2-6: divides the Training gauge by distance, elevation and kind", async () => {
		await seedBalance(ATHLETE_A, {
			distanceRynke: 70,
			elevationRynke: 30,
			trainingRynke: 200,
			trainingMissing: 50,
			teamRynke: 40,
			teamMissing: 0,
			teamEvents: kindSums([10, 10, 50], [4, 20, 40], [2, 10, 10]),
		});
		const [training, team] = await gauges();
		expect(training?.caption).toBe("Trainingsrynke: 200 von 250 · 80 %");
		expect(training?.legend).toEqual([
			"Distanz: 70",
			"Höhenmeter: 30",
			"Teamtraining: 50",
			"Tag Trainingswochenende: 40",
			"Techniktraining: 10",
		]);
		for (const [n, width] of [
			[1, "28.00"],
			[2, "12.00"],
			[3, "20.00"],
			[4, "16.00"],
			[5, "4.00"],
		] as const) {
			expect(training?.bar).toContain(
				`class="gauge-part gauge-part-${n}" style="width:${width}%"`,
			);
		}
		expect(team?.legend).toEqual([
			"Teamtraining: 10",
			"Tag Trainingswochenende: 20",
			"Techniktraining: 10",
		]);
		expect(team?.bar).toContain(
			'class="gauge-part gauge-part-4" style="width:50.00%"',
		);
	});

	it("keeps each source's colour when other parts are 0", async () => {
		await seedBalance(ATHLETE_A, {
			trainingRynke: 5,
			teamRynke: 5,
			teamEvents: kindSums([0, 0, 0], [0, 0, 0], [1, 5, 5]),
		});
		const [training, team] = await gauges();
		for (const [gauge, width] of [
			[training, "2.00"],
			[team, "20.00"],
		] as const) {
			expect(gauge?.bar).toBe(
				`<div class="gauge-bar" aria-hidden="true"><span class="gauge-part gauge-part-5" style="width:${width}%"></span></div>`,
			);
			expect(gauge?.legend).toEqual(["Techniktraining: 5"]);
		}
	});

	it("FR-061: names kinds and events in English", async () => {
		await seedBalance(ATHLETE_A, {
			teamRynke: 5,
			trainingRynke: 10,
			teamEvents: kindSums([0, 0, 0], [1, 5, 10], [0, 0, 0]),
		});
		await attendRaw(await insertEvent("training_weekend_day", "2026-05-09"), [
			ATHLETE_A,
		]);
		const { html } = await riderPage(ctx, ATHLETE_A, "/me", "en");
		const shown = text(
			section(html, 'class="rynke-breakdown card card-outlined"') ?? "",
		);
		expect(shown).toContain(
			"Training-weekend day attended 1 × → 5 Team Rynke, 10 Training Rynke",
		);
		expect(shown).toContain(
			"Your team events 09/05/2026 · Training-weekend day",
		);
	});

	it("shows no kind rows for a balance stored before team events (R5)", async () => {
		await seedBalance(ATHLETE_A, { teamEvents: [], rulesVersion: 1 });
		expect((await breakdown()).map(([dt]) => dt)).toEqual([
			"Distanz",
			"Höhenmeter",
			"Gesamt",
		]);
	});
});

/** Each ride card: its reason lines and its text below the figures. */
async function details(athleteId = ATHLETE_A, acceptLanguage?: string) {
	const { html } = await riderPage(ctx, athleteId, "/me/rides", acceptLanguage);
	return rideCards(html).map(({ html: inner }) => ({
		reasons: [
			...(
				inner.match(/<ul class="ride-reasons">([\s\S]*?)<\/ul>/)?.[1] ?? ""
			).matchAll(/<li>([\s\S]*?)<\/li>/g),
		].map((m) => text(m[1] ?? "")),
		all: text(inner.slice(inner.indexOf("</dl>"))),
	}));
}

const FIX_HINT =
	"Du kannst die Fahrt auf Strava korrigieren oder dich an das Orga-Team wenden.";

describe("GET /me/rides ride reasons (US4)", () => {
	beforeEach(() => seedBalance(ATHLETE_A));

	async function seedOverlap() {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-06T08:00:00Z",
			distance_m: 80000,
			result: { counts: true, distanceRynke: 8 },
		});
		await seedRide(ATHLETE_A, {
			id: 8_100_002,
			start_date: "2026-10-06T08:01:00Z",
			distance_m: 78000,
			result: {
				counts: false,
				reasons: ["overlap"],
				overlapsActivityId: 8_100_001,
			},
		});
	}

	async function seedPause() {
		await seedRide(ATHLETE_A, {
			id: 8_100_003,
			distance_m: 100000,
			moving_time_s: 14400,
			elapsed_time_s: 25200,
			result: { counts: false, reasons: ["pause"] },
		});
	}

	it("S4-1: names the ride that counted instead", async () => {
		await seedOverlap();
		const [overlap] = await details();
		expect(overlap?.reasons).toEqual([
			"Doppelt aufgezeichnet: Deine Fahrt vom 06.10.2026, 08:00 Uhr, 80,0 km zählt stattdessen.",
		]);
	});

	it("S4-2: gives the paused against the moving time", async () => {
		await seedPause();
		const [pause] = await details();
		expect(pause?.reasons).toEqual([
			"Zu lange Pause: 3 h 0 min Pause bei 4 h 0 min Bewegungszeit – mehr als die Hälfte ist nicht erlaubt.",
		]);
	});

	it("S4-3: lists both reasons of a slow manual entry", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_004,
			distance_m: 15000,
			moving_time_s: 7200,
			is_manual: 1,
			result: { counts: false, reasons: ["manual", "too_slow"] },
		});
		const [manual] = await details();
		expect(manual?.reasons).toEqual([
			"Manuell auf Strava eingetragen.",
			"Zu langsam: 7,5 km/h im Schnitt, mindestens 10 km/h sind nötig.",
		]);
	});

	it("S4-4: explains every remaining reason with its figure and limit", async () => {
		// Newest first, one day apart; the ride before the season start is last.
		const rides: Omit<SeedRide, "id">[] = [
			{ is_flagged: 1, result: { counts: false, reasons: ["flagged"] } },
			{
				distance_m: 45010,
				moving_time_s: 3600,
				result: { counts: false, reasons: ["too_fast"] },
			},
			{
				elevation_gain_m: 1500.4,
				moving_time_s: 3600,
				result: { counts: false, reasons: ["climbing_rate"] },
			},
			{
				sport_type: "EBikeRide",
				result: { counts: false, reasons: ["excluded_sport_type"] },
			},
			{
				start_date: "2025-12-20T08:00:00Z",
				result: { counts: false, reasons: ["outside_window"] },
			},
			// No version of RULES_HISTORY has a deadline yet: an unknown one.
			{
				result: {
					counts: false,
					reasons: ["outside_window"],
					rulesVersion: 99,
				},
			},
		];
		for (const [i, seeded] of rides.entries()) {
			await seedRide(ATHLETE_A, {
				id: 8_100_010 + i,
				start_date: `2026-09-${30 - i}T08:00:00Z`,
				...seeded,
			});
		}
		expect((await details()).map((d) => d.reasons)).toEqual([
			[
				"Strava hat die Fahrt markiert. Wenn du anderer Meinung bist, kläre das bitte mit Strava.",
			],
			[
				"Zu schnell für eine Radfahrt: 45,1 km/h im Schnitt, höchstens 45 km/h sind erlaubt.",
			],
			[
				"Zu viele Höhenmeter für die Zeit: 1.501 m/h bergauf, höchstens 1.500 m/h sind erlaubt.",
			],
			["E-Bike-Fahrt zählt nicht für die Rynke."],
			["Nach dem Stichtag."],
			["Vor dem Saisonstart am 01.01.2026."],
		]);
	});

	it("S4-5: marks a counting virtual ride", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_020,
			sport_type: "VirtualRide",
			result: { counts: true, distanceRynke: 4, isVirtual: true },
		});
		const [virtual] = await details();
		expect(virtual?.all).toContain("· virtuell");
		expect(virtual?.reasons).toEqual([]);
	});

	it("S4-6: says a ride with an unknown figure may still change", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_021,
			elapsed_time_s: null,
			result: {
				counts: true,
				distanceRynke: 4,
				unknownFigures: ["elapsed_time"],
			},
		});
		const [unknown] = await details();
		expect(unknown?.all).toContain(
			"Die Gesamtzeit mit Pausen fehlt noch, deshalb ist die Pausenregel noch nicht geprüft. Das Ergebnis kann sich noch ändern.",
		);
	});

	it("S4-7: offers the fix hint once, only for what the rider can fix", async () => {
		await seedOverlap();
		await seedPause();
		await seedRide(ATHLETE_A, {
			id: 8_100_030,
			start_date: "2026-04-01T08:00:00Z",
			is_manual: 1,
			result: { counts: false, reasons: ["manual", "pause"] },
		});
		await seedRide(ATHLETE_A, {
			id: 8_100_031,
			start_date: "2026-03-01T08:00:00Z",
			is_flagged: 1,
			result: { counts: false, reasons: ["flagged"] },
		});
		const hints = (await details()).map(
			(d) => d.all.split(FIX_HINT).length - 1,
		);
		// Newest first: overlap, counted ride, pause, manual + pause, flagged.
		expect(hints).toEqual([0, 0, 1, 1, 0]);
	});

	it("explains an unknown code in general words", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_040,
			result: { counts: false, reasons: ["new_rule" as ReasonCode] },
		});
		const { status } = await riderPage(ctx, ATHLETE_A);
		expect(status).toBe(200);
		const [unknown] = await details();
		expect(unknown?.reasons).toEqual([
			"Zählt nach den aktuellen Regeln nicht.",
		]);
	});

	it("FR-061: explains the reasons in English", async () => {
		await seedOverlap();
		await seedPause();
		const [overlap, , pause] = await details(ATHLETE_A, "en");
		expect(overlap?.reasons).toEqual([
			"Recorded twice: your ride of 06/10/2026, 08:00, 80.0 km counts instead.",
		]);
		expect(pause?.reasons).toEqual([
			"Paused too long: 3 h 0 min paused for 4 h 0 min moving time – more than half is not allowed.",
		]);
	});
});

describe("GET /me/rides ride cards (US1, 011 US2)", () => {
	beforeEach(() => seedBalance(ATHLETE_A));

	it("S1-6: shows a counting ride's Rynke and metres", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-06T08:00:00Z",
			distance_m: 79000,
			elevation_gain_m: 1240,
			result: { counts: true, distanceRynke: 7, elevationDm: 12400 },
		});
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
		const [card, ...more] = rideCards(html);
		expect(more).toEqual([]);
		expect(card?.status).toBe("ride-counting");
		expect(card?.cells).toEqual([
			"06.10.2026",
			"79,0 km",
			"zählt",
			"7",
			"1.240 m",
		]);
		// No elevation Rynke per ride, anywhere (FR-040).
		expect(card?.meta).toBe("Radfahrt · 1.240 m");
		expect(
			text(card?.html.match(/<p class="ride-strava">[\s\S]*?<\/p>/)?.[0] ?? ""),
		).toBe("View on Strava");
		// Nothing to explain: no disclosure.
		expect(card?.why).toBeNull();
		expect(html).toContain('<ol class="ride-list">');
		expect(html).not.toContain("<table");
	});

	it("S1-7: shows a ride that doesn't count with nothing, reasons open", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-05T08:00:00Z",
			distance_m: 30000,
			result: { counts: false, reasons: ["too_slow"] },
		});
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
		const [card] = rideCards(html);
		expect(card?.status).toBe("ride-not-counting");
		expect(card?.cells).toEqual([
			"05.10.2026",
			"30,0 km",
			"zählt nicht",
			"0",
			"0 m",
		]);
		expect(card?.open).toBe(true);
		expect(card?.why).toContain('<summary class="tap">Warum?</summary>');
	});

	it("S1-8: shows a ride without a result as being evaluated", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-10-04T08:00:00Z",
			distance_m: 40000,
		});
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
		const [card] = rideCards(html);
		expect(card?.status).toBe("ride-pending");
		expect(card?.cells).toEqual([
			"04.10.2026",
			"40,0 km",
			"wird ausgewertet",
			"–",
			"–",
		]);
		expect(card?.open).toBe(false);
	});

	it("keeps a counting ride's explanation closed (clarification Q5)", async () => {
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			result: {
				counts: true,
				distanceRynke: 4,
				unknownFigures: ["elapsed_time"],
			},
		});
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
		const [card] = rideCards(html);
		expect(card?.why).toMatch(/^<details class="ride-why"><summary/);
		expect(card?.open).toBe(false);
	});

	it("marks a virtual ride in its meta line", async () => {
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
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
		expect(rideCards(html)[0]?.meta).toBe("Virtuelle Fahrt · 300 m · virtuell");
	});

	it("labels the figures", async () => {
		await seedRide(ATHLETE_A, { id: 8_100_001 });
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides");
		expect(rideCards(html)[0]?.labels).toEqual([
			"Distanz",
			"Trainingsrynke",
			"Für die Höhenmeter",
		]);
	});
});

describe("GET /me/rides paging (US5)", () => {
	beforeEach(() => seedBalance(ATHLETE_A));

	/** The ride table's position line and pager links, `rel` → `href`. */
	async function pager(path: string) {
		const { html } = await riderPage(ctx, ATHLETE_A, path);
		const rides = section(html, 'id="rides"') ?? "";
		const nav = rides.match(/<nav class="pager"[^>]*>([\s\S]*?)<\/nav>/);
		return {
			html,
			rows: mainRows(html),
			position: text(
				rides.match(/<p class="rides-position">([\s\S]*?)<\/p>/)?.[1] ?? "",
			),
			nav: nav?.[0] ?? null,
			links: Object.fromEntries(
				[...(nav?.[1] ?? "").matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(
					([, attrs = "", label = ""]) => [
						attrs.match(/rel="([^"]*)"/)?.[1],
						{
							href: attrs.match(/href="([^"]*)"/)?.[1],
							cls: attrs.match(/class="([^"]*)"/)?.[1],
							text: text(label),
						},
					],
				),
			),
		};
	}

	// One ride a day from 2026-10-06 back, so ride n (1 = newest) is dated
	// 2026-10-06 minus n - 1 days.
	const DAY_1 = "06.10.2026";
	const DAY_21 = "16.09.2026";
	const DAY_41 = "27.08.2026";
	const DAY_45 = "23.08.2026";

	it("S5-1: shows the 20 newest and links to the older ones", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const page = await pager("/me/rides");
		expect(page.rows).toHaveLength(20);
		expect(page.rows[0]?.[0]).toBe(DAY_1);
		expect(page.position).toBe("Fahrten 1–20 von 45");
		expect(page.nav).toContain('aria-label="Seiten"');
		expect(page.links).toEqual({
			next: { href: "/me/rides?page=2", cls: "tap", text: "Ältere ›" },
			last: { href: "/me/rides?page=3", cls: "tap", text: "Älteste »" },
		});
	});

	it("S5-2: pages through the older rides", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");

		const second = await pager("/me/rides?page=2");
		expect(second.rows).toHaveLength(20);
		expect(second.rows[0]?.[0]).toBe(DAY_21);
		expect(second.position).toBe("Fahrten 21–40 von 45");
		expect(second.links).toEqual({
			first: { href: "/me/rides?page=1", cls: "tap", text: "« Neueste" },
			prev: { href: "/me/rides?page=1", cls: "tap", text: "‹ Neuere" },
			next: { href: "/me/rides?page=3", cls: "tap", text: "Ältere ›" },
			last: { href: "/me/rides?page=3", cls: "tap", text: "Älteste »" },
		});

		const third = await pager("/me/rides?page=3");
		expect(third.rows.map((row) => row[0])).toEqual([
			DAY_41,
			"26.08.2026",
			"25.08.2026",
			"24.08.2026",
			DAY_45,
		]);
		expect(third.position).toBe("Fahrten 41–45 von 45");
		expect(third.links).toEqual({
			first: { href: "/me/rides?page=1", cls: "tap", text: "« Neueste" },
			prev: { href: "/me/rides?page=2", cls: "tap", text: "‹ Neuere" },
		});
	});

	it("S5-3: shows no pager and no position for 20 rides", async () => {
		await seedRides(ATHLETE_A, 20, "2026-10-06");
		const page = await pager("/me/rides");
		expect(page.rows).toHaveLength(20);
		expect(page.nav).toBeNull();
		expect(page.html).not.toContain("rides-position");
	});

	it("S5-5: names a ride on page 1 that a ride on page 3 overlaps", async () => {
		await seedRides(ATHLETE_A, 44, "2026-10-06");
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			start_date: "2026-08-01T09:30:00Z",
			result: {
				counts: false,
				reasons: ["overlap"],
				overlapsActivityId: 8_000_001,
			},
		});
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/rides?page=3");
		expect(text(html)).toContain(
			`Doppelt aufgezeichnet: Deine Fahrt vom ${DAY_1}, 08:00 Uhr, 40,0 km zählt stattdessen.`,
		);
	});

	it("shows the last page for a page past the end", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const page = await pager("/me/rides?page=99");
		expect(page.rows).toHaveLength(5);
		expect(page.position).toBe("Fahrten 41–45 von 45");
		expect(page.links.prev?.href).toBe("/me/rides?page=2");
	});

	it("shows page 1 for a page that isn't a number", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const page = await pager("/me/rides?page=abc");
		expect(page.position).toBe("Fahrten 1–20 von 45");
	});

	it("SC-005: pages through 500 rides by the rider's index", async () => {
		await seedRides(ATHLETE_A, 500, "2026-10-06");
		for (const path of ["/me/rides", "/me/rides?page=25"]) {
			const page = await pager(path);
			expect(page.rows).toHaveLength(20);
		}
		expect((await pager("/me/rides?page=25")).position).toBe(
			"Fahrten 481–500 von 500",
		);

		const { results } = await env.DB.prepare(
			`EXPLAIN QUERY PLAN ${RIDE_PAGE_SQL}`,
		)
			.bind(ATHLETE_A, 25)
			.all<{ detail: string }>();
		const plan = results.map((row) => row.detail);
		expect(plan.some((step) => step.includes("activities_by_rider"))).toBe(
			true,
		);
		// The outer table is `a`, the joined one `c`: no step reads a whole table.
		expect(
			plan.filter(
				(step) =>
					/^SCAN (a|c|activities)\b/.test(step) && !step.includes("USING"),
			),
		).toEqual([]);
	});

	/** The `href` and text of every link to Strava, and the card count. */
	async function stravaLinks(path: string, acceptLanguage?: string) {
		const { html } = await riderPage(ctx, ATHLETE_A, path, acceptLanguage);
		return {
			details: rideCards(html).length,
			links: [
				...html.matchAll(
					/<a class="tap strava-activity" href="([^"]*)">([\s\S]*?)<\/a>/g,
				),
			].map(([, href, label]) => ({ href, text: text(label ?? "") })),
		};
	}

	/** Seeded by `seedRides`, ride n (1 = newest) has ID 8_000_000 + n. */
	const hrefs = (from: number, to: number) =>
		Array.from(
			{ length: to - from + 1 },
			(_, i) => `https://www.strava.com/activities/${8_000_000 + from + i}`,
		);

	it("SC-001: links every ride on pages 1 and 3 to Strava (008 FR-009)", async () => {
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		for (const [path, expected] of [
			["/me/rides?page=1", hrefs(1, 20)],
			["/me/rides?page=3", hrefs(41, 45)],
		] as const) {
			const page = await stravaLinks(path);
			expect(page.links.map((link) => link.href)).toEqual(expected);
			expect(page.links).toHaveLength(page.details);
			expect(new Set(page.links.map((link) => link.text))).toEqual(
				new Set(["View on Strava"]),
			);
		}
		const english = await stravaLinks("/me/rides?page=1", "en");
		expect(english.links.map((link) => link.href)).toEqual(hrefs(1, 20));
		expect(new Set(english.links.map((link) => link.text))).toEqual(
			new Set(["View on Strava"]),
		);
	});

	it("links a private ride like any other (008 FR-011, S1-3)", async () => {
		await seedRide(ATHLETE_A, { id: 8_900_201, is_private: 1 });
		const page = await stravaLinks("/me/rides");
		expect(page.links.map((link) => link.href)).toEqual([
			"https://www.strava.com/activities/8900201",
		]);
	});
});

/** The text of the notice and rules sections, `null` when absent. */
async function rulesAndNotice(athleteId = ATHLETE_A, acceptLanguage?: string) {
	const { html } = await riderPage(ctx, athleteId, "/me", acceptLanguage);
	const notice = section(html, 'class="notice" role="status"');
	const rules = section(html, 'class="rynke-rules card card-outlined"');
	return {
		html,
		notice: notice === null ? null : text(notice),
		rules: rules === null ? null : text(rules),
	};
}

/** The version in effect, and a newer one a stale balance can't carry yet. */
const VERSION = CURRENT_RULES.version;
const NEXT = VERSION + 1;

const UPDATING =
	"Die Regeln haben sich geändert: Seit dem 07.10.2026 gelten neue Regeln.";
const IMPORTING = "Deine Fahrten seit dem 01.01.2026 werden noch importiert.";

describe("GET /me rules and notices (US6)", () => {
	it("S6-1: names the rules version, the window and the handout", async () => {
		await seedBalance(ATHLETE_A);
		const { html, notice, rules } = await rulesAndNotice();
		expect(rules).toContain(
			`Berechnet nach Regel-Version ${VERSION}, gültig seit dem 07.10.2026.`,
		);
		expect(rules).toContain("Es zählt alles ab dem 01.01.2026.");
		const link = section(html, 'class="rynke-rules card card-outlined"')?.match(
			/<a class="tap" href="([^"]*)">([^<]*)<\/a>/,
		);
		expect(link?.[1]).toBe(RULES_HANDOUT_URL);
		expect(link?.[2]).toBe("So funktionieren die Rynke (Regeln zum Nachlesen)");
		expect(notice).toBeNull();
		expect(html).not.toContain("Die Regeln haben sich geändert");
	});

	it("S6-2: says the numbers are being updated to other rules", async () => {
		await seedBalance(ATHLETE_A, {
			rulesVersion: NEXT,
			rulesEffectiveDate: "2026-11-01",
		});
		const { html, notice, rules } = await rulesAndNotice();
		expect(notice).toContain(UPDATING);
		expect(notice).toContain(
			`bis dahin siehst du sie nach Regel-Version ${NEXT}.`,
		);
		expect(rules).toContain(
			`Berechnet nach Regel-Version ${NEXT}, gültig seit dem 01.11.2026.`,
		);
		// NEXT isn't in RULES_HISTORY: no targets, no gauges (FR-013).
		expect(html).not.toContain('class="rynke-gauges"');
		expect(html).not.toContain("von 250");
	});

	it("S6-3: drops the notice once re-evaluated under the version in effect", async () => {
		await seedBalance(ATHLETE_A, { rulesVersion: NEXT });
		expect((await rulesAndNotice()).notice).toContain(UPDATING);
		await seedBalance(ATHLETE_A);
		const { notice, rules } = await rulesAndNotice();
		expect(notice).toBeNull();
		expect(rules).toContain(`Regel-Version ${VERSION}`);
	});

	it("S6-4: says the Rynke will grow while the import runs", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, importStatus: "running" });
		const before = await rulesAndNotice(ATHLETE_B);
		expect(before.notice).toContain("Deine Rynke werden gerade berechnet.");
		expect(before.notice).toContain(IMPORTING);
		expect(before.rules).toBeNull();

		await seedBalance(ATHLETE_B, { trainingRynke: 12, trainingMissing: 238 });
		const after = await rulesAndNotice(ATHLETE_B);
		expect(after.notice).toBe(
			"Deine Fahrten seit dem 01.01.2026 werden noch importiert. Deine Rynke wachsen, sobald sie da sind.",
		);
		expect(after.html).toContain('class="rynke-summary verdict card"');
		// Said once: feature 001's status line shows only a finished import.
		expect(after.html.split("werden noch importiert").length - 1).toBe(1);
		expect(after.html).not.toContain("werden importiert …");
	});

	it("S6-5: says in English that the handout is in German", async () => {
		await seedBalance(ATHLETE_A);
		const { rules } = await rulesAndNotice(ATHLETE_A, "en");
		expect(rules).toContain(
			`Computed with rules version ${VERSION}, in effect since`,
		);
		expect(rules).toContain("in German");
	});

	it("S6-6: starts no evaluation however often it is opened", async () => {
		await seedBalance(ATHLETE_A, { rulesVersion: NEXT });
		for (let i = 0; i < 3; i++) {
			expect((await rulesAndNotice()).notice).toContain(UPDATING);
		}
		expect(ctx.queue.sent).toEqual([]);
		expect(fake.calls).toEqual([]);
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

		const shown = async (athleteId: number) =>
			text(
				(await riderPage(ctx, athleteId)).html +
					(await riderPage(ctx, athleteId, "/me/rides")).html,
			);

		const a = await shown(ATHLETE_A);
		expect(a).toContain("111 von 250");
		expect(a).toContain("51,0 km");
		expect(a).not.toContain("222 von");
		expect(a).not.toContain("93,0 km");

		const b = await shown(ATHLETE_B);
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

	it("SC-004: only reads, with attendance", async () => {
		await seedBalance(ATHLETE_A, {
			teamRynke: 1,
			trainingRynke: 5,
			teamEvents: kindSums([1, 1, 5], [0, 0, 0], [0, 0, 0]),
		});
		await attendRaw(await insertEvent("team_training", "2026-05-12"), [
			ATHLETE_A,
		]);
		const counts = await tableCounts();
		const attendance = await attendanceRows();
		const rows = await snapshot(ATHLETE_A);

		expect((await riderPage(ctx, ATHLETE_A)).status).toBe(200);

		expect(await tableCounts()).toEqual(counts);
		expect(await attendanceRows()).toEqual(attendance);
		expect(await snapshot(ATHLETE_A)).toEqual(rows);
		expect(ctx.queue.sent).toEqual([]);
		expect(fake.calls).toEqual([]);
	});

	it("SC-004: paging only reads", async () => {
		await seedBalance(ATHLETE_A);
		await seedRides(ATHLETE_A, 45, "2026-10-06");
		const counts = await tableCounts();
		const rows = await snapshot(ATHLETE_A);

		for (const path of [
			"/me",
			"/me/rides",
			"/me/rides?page=2",
			"/me/rides?page=3",
		]) {
			expect((await riderPage(ctx, ATHLETE_A, path)).status).toBe(200);
		}

		expect(await tableCounts()).toEqual(counts);
		expect(await snapshot(ATHLETE_A)).toEqual(rows);
		expect(ctx.queue.sent).toEqual([]);
		expect(fake.calls).toEqual([]);
	});

	it("places the sections after the import status, without rides or consent", async () => {
		await seedBalance(ATHLETE_A);
		await seedRide(ATHLETE_A, { id: 8_100_001 });
		const { html } = await riderPage(ctx, ATHLETE_A);
		const order = [
			"<p>Import abgeschlossen</p>",
			'<section id="rynke" class="rynke-summary verdict card">',
			'<section class="rynke-breakdown card card-outlined">',
			'<section class="rynke-rules card card-outlined">',
		].map((marker) => html.indexOf(marker));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((x, y) => x - y)).toEqual(order);
		expect(html).not.toContain('<section id="rides">');
		expect(html).not.toContain("<h2>Deine Zustimmung</h2>");
	});
});
