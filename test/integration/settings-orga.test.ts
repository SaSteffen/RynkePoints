import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";

// "Wer in der Orga ist" in Settings (feature 043 FR-021, FR-022): organisers and
// administrators see who is in the Orga; own administrators get the link to
// Rollen; riders without a role get no row. Synthetic riders only.

const ctx = makeCtx();
const de = CATALOGS.de;
const GUEST = "900009";

async function settings(athleteId: string) {
	return (
		await handleFetch(
			request("/me/settings", {
				cookies: await sessionCookie(ctx, athleteId),
			}),
			ctx,
		)
	).text();
}

const row = escapeHtml(de["settings.orga.title"]);
const link = 'href="/admin/riders"';

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ATHLETE_C,
		firstName: "Ada",
		administrator: true,
	});
	await seedRider(ctx, {
		athleteId: ATHLETE_B,
		firstName: "Olga",
		organiser: true,
	});
	await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Fiona" });
	await seedRider(ctx, { athleteId: GUEST, firstName: "Quirin", guest: true });
});

describe("Wer in der Orga ist", () => {
	it("lists administrators first, marked, then organisers, for an organiser", async () => {
		const page = await settings(ATHLETE_B);
		expect(page).toContain(row);
		expect(page).toContain(
			escapeHtml(`${de["settings.orga.admin"].replace("{name}", "Ada")}, Olga`),
		);
		expect(page).not.toContain("Quirin");
		expect(page).not.toContain(link);
	});

	it("links an own administrator to Rider und Rollen", async () => {
		const page = await settings(ATHLETE_C);
		expect(page).toContain(row);
		expect(page).toContain(link);
		expect(page).toContain(escapeHtml(de["settings.orga.link"]));
	});

	it("has no link for a guest", async () => {
		const page = await settings(GUEST);
		expect(page).toContain(row);
		expect(page).not.toContain(link);
	});

	it("isn't there for a rider without a role", async () => {
		expect(await settings(ATHLETE_A)).not.toContain(row);
	});
});
