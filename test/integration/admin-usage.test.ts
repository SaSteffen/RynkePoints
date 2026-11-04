import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import {
	cloudflareBody,
	installCloudflare,
	seedUsageDay,
	setCloudflareState,
	setStravaUsage,
	WITH_ANALYTICS,
} from "../support/usage";

// `/admin` (feature 025 US1, US3's waiting work and US5's switch and hint). Only
// synthetic figures; viewing never calls `fetch` (FR-027).

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const TODAY = "2026-11-04";
const de = CATALOGS.de;
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;

async function page(lang = "de") {
	const res = await handleFetch(
		request("/admin", {
			cookies: await sessionCookie(ctx, ADMIN),
			acceptLanguage: lang,
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

/** The list item of an allowance, by its German name. */
function figure(text: string, id: keyof typeof de): string {
	const items = text.split('<li class="usage-figure');
	return (
		items.find((item) => item.includes(`>${de[id]}<`)) ??
		`missing ${String(id)}`
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
});

describe("Strava's figures", () => {
	it("shows used, limit, percentage, team, not attributed and time (scenarios 1, 2)", async () => {
		await setStravaUsage({
			observedAt: NOW - 60,
			readDaily: 1200,
			ownReadDaily: 900,
		});
		const item = figure(await page(), "admin.allowance.strava_read_daily");
		expect(item).toContain("1.200 von 3.000 · 40 %");
		expect(item).toContain("Dieses Team: 900 · Nicht zugeordnet: 300");
		expect(item).toContain("Stand: 04.11.2026, 11:59 UTC");
	});

	it("marks 80 % as a warning and 95 % as critical, in words (scenarios 3, 4, FR-009)", async () => {
		await setStravaUsage({
			observedAt: NOW - 60,
			readDaily: 2400,
			allDaily: 5700,
		});
		const text = await page();
		const warning = figure(text, "admin.allowance.strava_read_daily");
		expect(warning).toContain(">Warnung<");
		const critical = figure(text, "admin.allowance.strava_all_daily");
		expect(critical).toContain(">Kritisch<");
		const fine = figure(text, "admin.allowance.strava_read_15m");
		expect(fine).not.toContain("usage-mark");
		expect(text).toContain(de["admin.summary.attention"].replace("{n}", "2"));
	});

	it("says all is well below 80 %", async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 10 });
		expect(await page()).toContain(de["admin.summary.ok"]);
	});

	it("doesn't cap above 100 %", async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 3600 });
		expect(figure(await page(), "admin.allowance.strava_read_daily")).toContain(
			"120 %",
		);
	});

	it("counts an old day as zero with the time of the last observation", async () => {
		await setStravaUsage({
			observedAt: NOW - 86_400,
			readDaily: 1200,
			ownReadDaily: 900,
		});
		const item = figure(await page(), "admin.allowance.strava_read_daily");
		expect(item).toContain("0 von 3.000 · 0 %");
		expect(item).toContain("Stand: 03.11.2026, 12:00 UTC");
	});

	it("shows the connected riders against the capacity", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		const item = figure(await page(), "admin.allowance.riders_connected");
		expect(item).toContain("2 von 999 · 0 %");
	});
});

describe("Cloudflare's figures", () => {
	beforeEach(async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 1200 });
	});

	it("says they cover the whole account and are approximate (FR-008, FR-012)", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_worker_requests", 50_000, 100_000, {
			recordedAt: NOW - 120,
		});
		const text = await page();
		expect(text).toContain(de["admin.cloudflare.note"]);
		expect(text).not.toContain(de["admin.cloudflare.unavailable"]);
		const item = figure(text, "admin.allowance.cf_worker_requests");
		expect(item).toContain("50.000 von 100.000 · 50 %");
		expect(item).not.toContain("Dieses Team");
		expect(item).toContain("Stand: 04.11.2026, 11:58 UTC");
	});

	it("shows storage in GB", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(
			TODAY,
			"cf_d1_storage_bytes",
			1_250_000_000,
			5_000_000_000,
		);
		expect(
			figure(await page(), "admin.allowance.cf_d1_storage_bytes"),
		).toContain("1,25 GB von 5,00 GB · 25 %");
	});

	it("on a failure says so, with the last known values and their time (scenario 5, FR-011, SC-007)", async () => {
		await setCloudflareState(NOW - 7200, NOW);
		await seedUsageDay("2026-11-03", "cf_d1_rows_read", 2_500_000, 5_000_000, {
			recordedAt: NOW - 7200,
		});
		const text = await page();
		expect(text).toContain(de["admin.cloudflare.unavailable"]);
		const item = figure(text, "admin.allowance.cf_d1_rows_read");
		expect(item).toContain("2.500.000 von 5.000.000 · 50 %");
		expect(item).toContain("Stand: 04.11.2026, 10:00 UTC");
		expect(figure(text, "admin.allowance.strava_read_daily")).toContain(
			"1.200 von 3.000",
		);
	});

	it("never shows zero for a figure it has no value for", async () => {
		const text = await page();
		expect(text).toContain(de["admin.cloudflare.unavailable"]);
		const item = figure(text, "admin.allowance.cf_queue_operations");
		expect(item).toContain("Noch kein Wert");
		expect(item).not.toContain("0 von");
	});

	it("keeps the limit a record was made with", async () => {
		await setCloudflareState(NOW, null);
		await seedUsageDay(TODAY, "cf_queue_operations", 100, 1000);
		expect(
			figure(await page(), "admin.allowance.cf_queue_operations"),
		).toContain("100 von 1.000 · 10 %");
	});
});

describe("viewing", () => {
	it("calls no fetch at all (FR-027)", async () => {
		await page();
		expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
	});

	it("renders in English too (FR-025)", async () => {
		await setStravaUsage({ observedAt: NOW - 60, readDaily: 1200 });
		const text = await page("en");
		expect(text).toContain("1,200 of 3,000 · 40 %");
		expect(text).toContain(CATALOGS.en["admin.cloudflare.note"].slice(0, 20));
	});
});

describe("waiting work (US3 scenario 3, FR-020)", () => {
	const wait = async (n: number) => {
		for (let i = 0; i < n; i++) {
			await env.DB.prepare(
				`INSERT INTO strava_work (athlete_id, message, kind, attempts, not_before, stored_at)
				VALUES (?, '{}', 'import-page', 1, 0, ?)`,
			)
				.bind(ADMIN, NOW)
				.run();
		}
	};

	it("shows nothing when nothing waits", async () => {
		expect(await page()).not.toContain(de["admin.waiting.heading"]);
	});

	it("gets the singular right", async () => {
		await setStravaUsage({ observedAt: NOW - 60 });
		await wait(1);
		expect(await page()).toContain(
			"1 Eintrag wartet, fertig in etwa 15 Minuten.",
		);
	});

	it("shows how many and about how long, naming nobody", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Synthetica" });
		await setStravaUsage({ observedAt: NOW - 60 });
		await wait(3);
		const text = await page();
		expect(text).toContain(de["admin.waiting.heading"]);
		expect(text).toContain("3 Einträge warten, fertig in etwa 15 Minuten.");
		expect(text).not.toContain("Synthetica");
	});
});

describe("updating now (FR-040)", () => {
	const refresh = async (target = ctx) =>
		handleFetch(
			request("/admin/refresh", {
				form: {},
				cookies: await sessionCookie(target, ADMIN),
			}),
			target,
		);

	it("records Cloudflare's figures, and a repeat doesn't count twice", async () => {
		installCloudflare(() =>
			Response.json(cloudflareBody({ [TODAY]: { requests: 1234 } })),
		);
		const target = { ...ctx, env: { ...ctx.env, ...WITH_ANALYTICS } };
		for (const _ of [1, 2]) {
			const res = await refresh(target);
			expect(res.status).toBe(303);
			expect(res.headers.get("Location")).toBe("/admin");
		}
		const { results } = await env.DB.prepare(
			"SELECT used FROM usage_daily WHERE allowance = 'cf_worker_requests'",
		).all();
		expect(results).toEqual([{ used: 1234 }]);
		vi.mocked(globalThis.fetch).mockRestore();
	});

	it("still answers without the secrets", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect((await refresh()).status).toBe(303);
		expect(await page()).toContain(de["admin.cloudflare.unavailable"]);
		warn.mockRestore();
	});
});

describe("usage alerts switch (FR-039)", () => {
	const set = async (athleteId: number, value: string) =>
		handleFetch(
			request("/admin/alerts", {
				form: { admin_alerts: value },
				cookies: await sessionCookie(ctx, athleteId),
			}),
			ctx,
		);
	const stored = (athleteId: number) =>
		env.DB.prepare("SELECT admin_alerts FROM riders WHERE athlete_id = ?")
			.bind(athleteId)
			.first("admin_alerts");

	it("is on by default", async () => {
		expect(await stored(ADMIN)).toBe(1);
		expect(await page()).toContain(de["admin.alerts.turnOff"]);
	});

	it("sets only the viewer's own, and stays set after a reload", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, administrator: true });
		const res = await set(ADMIN, "off");
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/admin");
		expect(await stored(ADMIN)).toBe(0);
		expect(await stored(ATHLETE_B)).toBe(1);
		const text = await page();
		expect(text).toContain(de["admin.alerts.turnOn"]);
		expect(text).toContain(de["admin.alerts.off"]);
		await set(ADMIN, "on");
		expect(await stored(ADMIN)).toBe(1);
	});

	it("ignores anything but on and off", async () => {
		await set(ADMIN, "maybe");
		expect(await stored(ADMIN)).toBe(1);
	});
});

describe("the notifications hint (US5 scenario 5)", () => {
	it("appears without a device, saying where to turn them on", async () => {
		const text = await page();
		expect(text).toContain("Du bekommst keine Hinweise");
		expect(text).toContain('<a href="/me/settings">');
	});

	it("goes with a device", async () => {
		await seedSubscription(ADMIN, pushEndpoint(1));
		expect(await page()).not.toContain("Du bekommst keine Hinweise");
	});
});
