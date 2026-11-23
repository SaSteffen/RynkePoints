import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { europe } from "../../src/teams/europe";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";

// The Orga in plain words on Admin › Rider und Rollen (feature 045 US6, FR-016,
// FR-017, SC-005): Termine only on a team that has them. Both teams run on the
// same database; only the team data differs. Synthetic riders only.

const hamburg = makeCtx();
const other = makeCtx({ team: europe });
const de = CATALOGS.de;

async function tab(ctx: typeof hamburg) {
	const res = await handleFetch(
		request("/admin/riders", {
			cookies: await sessionCookie(ctx, ATHLETE_A),
			acceptLanguage: "de",
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(hamburg, {
		athleteId: ATHLETE_A,
		firstName: "Ada",
		administrator: true,
	});
	await seedRider(hamburg, { athleteId: ATHLETE_B, firstName: "Bo" });
});

describe("the Orga's description", () => {
	it("names the Termine on a team with events", async () => {
		const page = await tab(hamburg);
		expect(page).toContain(escapeHtml(de["admin.roles.hint.events"]));
		expect(page).toContain(
			escapeHtml(de["admin.roles.choice.orga.text.events"]),
		);
	});

	it("leaves them out on a team without", async () => {
		const page = await tab(other);
		expect(page).toContain(escapeHtml(de["admin.roles.hint"]));
		expect(page).toContain(escapeHtml(de["admin.roles.choice.orga.text"]));
		expect(page).not.toContain("Termine");
	});
});
