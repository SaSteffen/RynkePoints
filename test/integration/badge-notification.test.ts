import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";

// The notification text names a new badge (feature 013 research R17,
// contracts/badge-messages.md "Notification text"). Synthetic rises only.

const ctx = makeCtx();

async function riderText(lang = "de") {
	const res = await handleFetch(
		request(`/me/notification-text?lang=${lang}`, {
			cookies: await sessionCookie(ctx, ATHLETE_A),
		}),
		ctx,
	);
	return {
		status: res.status,
		body:
			res.status === 200
				? ((await res.json()) as { title: string; body: string }).body
				: null,
	};
}

async function seedRise(at: number) {
	await env.DB.prepare(
		"INSERT INTO rynke_rises (athlete_id, training_rynke, team_rynke, risen_at) VALUES (?, 3, 0, ?)",
	)
		.bind(ATHLETE_A, at)
		.run();
}

async function seedBadgeRise(ids: string[], at: number) {
	await env.DB.prepare(
		"INSERT INTO badge_rises (athlete_id, badge_ids, risen_at) VALUES (?, ?, ?)",
	)
		.bind(ATHLETE_A, JSON.stringify(ids), at)
		.run();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx);
	await seedBalance(ATHLETE_A, { trainingRynke: 30 });
});

describe("GET /me/notification-text with a badge rise", () => {
	it("names the one new badge in German, in every app language", async () => {
		await seedRise(NOW - 60);
		await seedBadgeRise(["distance-100"], NOW);
		const name = BADGE_NAMES["distance-100"] ?? "";
		expect(await riderText()).toEqual({
			status: 200,
			body: CATALOGS.de["notification.badge"].replace("{name}", name),
		});
		expect((await riderText("en")).body).toBe(
			CATALOGS.en["notification.badge"].replace("{name}", name),
		);
	});

	it("counts several new badges", async () => {
		await seedBadgeRise(["distance-100", "elevation-1000"], NOW);
		expect((await riderText()).body).toBe(
			CATALOGS.de["notification.badges"].replace("{n}", "2"),
		);
	});

	it("names the badge when both rose with the same change", async () => {
		await seedRise(NOW);
		await seedBadgeRise(["distance-100"], NOW);
		expect((await riderText()).body).toContain(
			BADGE_NAMES["distance-100"] ?? "",
		);
	});

	it("names the Rynke when their rise came later", async () => {
		await seedBadgeRise(["distance-100"], NOW - 60);
		await seedRise(NOW);
		const { body } = await riderText();
		expect(body).toContain("+3 Trainingsrynke");
		expect(body).not.toContain(BADGE_NAMES["distance-100"] ?? "");
	});

	it("has nothing to add without any rise", async () => {
		expect(await riderText()).toEqual({ status: 204, body: null });
	});
});
