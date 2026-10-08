import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { handleFetch } from "../../src/index";
import { makeCtx, ORIGIN, resetDb } from "../support/ctx";
import { ATHLETE_A, ATHLETE_C } from "../support/fixtures";
import { RIDE_NAMES, RIDER_PAGES, seedPageRiders } from "../support/pages";

// A ride's name is shown only on its rider's own page (feature 008 FR-008,
// SC-005, research R7). Every rider-facing page and the admin route are
// searched for each name, raw and as the page would escape it.

const ctx = makeCtx();
// Since feature 011 the rides are only in the Rides section.
const OWN_PAGES = new Map([
	["/me/rides connected", ATHLETE_A],
	["/me/rides not worked out", ATHLETE_C],
]);

function names(athleteId: number): string[] {
	return RIDE_NAMES[athleteId] ?? [];
}

function shown(body: string, name: string): boolean {
	return body.includes(name) || body.includes(escapeHtml(name));
}

beforeEach(async () => {
	await resetDb();
	await seedPageRiders(ctx);
});

describe.each(RIDER_PAGES.filter((page) => !OWN_PAGES.has(page.name)))(
	"$name",
	(page) => {
		it("shows no ride name", async () => {
			const body = await (await page.fetch(ctx, {})).text();
			for (const name of [...names(ATHLETE_A), ...names(ATHLETE_C)]) {
				expect(shown(body, name), name).toBe(false);
			}
		});
	},
);

describe("POST /admin/run-daily", () => {
	it("answers without a ride name", async () => {
		const res = await handleFetch(
			new Request(`${ORIGIN}/admin/run-daily`, {
				method: "POST",
				headers: { Authorization: "Bearer test-admin-token" },
			}),
			ctx,
		);
		const body = await res.text();
		for (const name of [...names(ATHLETE_A), ...names(ATHLETE_C)]) {
			expect(shown(body, name), name).toBe(false);
		}
		await Promise.all(ctx.pending);
	});
});

describe.each([...OWN_PAGES])("%s", (pageName, owner) => {
	it("shows only its rider's ride names", async () => {
		const page = RIDER_PAGES.find((p) => p.name === pageName);
		if (!page) throw new Error(`no rider page ${pageName}`);
		const body = await (await page.fetch(ctx, {})).text();
		const other = owner === ATHLETE_A ? ATHLETE_C : ATHLETE_A;
		for (const name of names(owner)) {
			expect(shown(body, name), name).toBe(true);
		}
		for (const name of names(other)) {
			expect(shown(body, name), name).toBe(false);
		}
	});
});
