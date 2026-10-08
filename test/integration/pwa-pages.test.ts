import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Ctx } from "../../src/ctx";
import { createSessionCookie } from "../../src/http/session";
import { handleFetch } from "../../src/index";
import { vapidPublicKey } from "../../src/push/vapid";
import { evaluateChange } from "../../src/rynke/apply";
import {
	cookiePair,
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, firstNameFor, NOW } from "../support/fixtures";
import { seedBalance, seedRide } from "../support/rider-view";

// The installable app's markup and its two cached texts (feature 010
// contracts/client.md and contracts/http-routes.md; FR-001–FR-005, FR-041,
// SC-007, SC-008).

const ctx = makeCtx();

const HEAD = [
	'<link rel="manifest" href="/manifest.webmanifest">',
	'<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">',
	'<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
	'<meta name="theme-color" content="#111111">',
	'<script src="/app.js" defer></script>',
];

const INSTALL_HINT = `<aside id="install" class="notice" hidden>
<p data-install="prompt" hidden><button type="button" class="tap">Als App installieren</button></p>
<p data-install="ios" hidden>Als App auf dem iPhone: Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“.</p>
<button type="button" data-install="dismiss" class="tap">Ausblenden</button>
</aside>`;

async function get(path: string, cookies?: Record<string, string>) {
	const res = await handleFetch(request(path, { cookies }), ctx);
	return { res, page: await res.text() };
}

/** A context whose D1 throws on any use, to prove a route never reads it. */
function withoutDb(base: Ctx): Ctx {
	const db = new Proxy(
		{},
		{
			get() {
				throw new Error("this route must not use D1");
			},
		},
	) as D1Database;
	return { ...base, env: { ...base.env, DB: db } };
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

describe("every page's head", () => {
	it.each([
		["/", false],
		["/me", true],
		["/me/disconnect", true],
		["/notice/deleted", false],
	])("%s links the manifest, icons and app.js", async (path, signedIn) => {
		const cookies = signedIn ? await sessionCookie(ctx, ATHLETE_A) : undefined;
		const { res, page } = await get(path, cookies);
		expect(res.status).toBe(200);
		const head = page.slice(page.indexOf("<head>"), page.indexOf("</head>"));
		for (const line of HEAD) expect(head).toContain(line);
		expect(head).toContain(
			'<meta name="viewport" content="width=device-width, initial-scale=1">',
		);
		expect(page).not.toContain("viewport-fit");
	});
});

describe("install hint (FR-004)", () => {
	it("is on / and /me, hidden, with the German texts", async () => {
		const landing = await get("/");
		const me = await get("/me", await sessionCookie(ctx, ATHLETE_A));
		expect(landing.page).toContain(INSTALL_HINT);
		expect(me.page).toContain(INSTALL_HINT);
	});

	it("is not on the other pages", async () => {
		const { page } = await get("/notice/deleted");
		expect(page).not.toContain('id="install"');
	});
});

describe("notifications section (FR-010, FR-011)", () => {
	const SECTION = `<section id="notifications" data-push-key="${vapidPublicKey(ctx.env)}" hidden>
<h2>Benachrichtigungen</h2>
<p>Auf Wunsch sagt dir dieses Gerät Bescheid, wenn du neue Rynke hast: wie viele und was dir noch fehlt.</p>
<p data-state="on" hidden>Benachrichtigungen sind auf diesem Gerät an.</p>
<p data-state="off" hidden>Benachrichtigungen sind auf diesem Gerät aus.</p>
<p data-state="blocked" hidden>Benachrichtigungen bleiben aus, weil dein Gerät sie für RynkePoints blockiert. Du kannst sie in den Einstellungen des Browsers oder Geräts erlauben.</p>
<p data-state="needsHomeScreen" hidden>Auf dem iPhone gibt es Benachrichtigungen nur, wenn RynkePoints auf dem Home-Bildschirm liegt. Öffne es dann von dort.</p>
<p data-state="unsupported" hidden>Dieser Browser kann keine Benachrichtigungen anzeigen.</p>
<p data-state="failed" hidden>Das hat nicht geklappt. Versuch es bitte noch einmal.</p>
<button type="button" data-action="on" class="tap" hidden>Benachrichtigungen einschalten</button>
<button type="button" data-action="off" class="tap" hidden>Benachrichtigungen ausschalten</button>
</section>`;

	it("is on /me between the rules and the ride table, all hidden", async () => {
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		const { page } = await get("/me", await sessionCookie(ctx, ATHLETE_A));
		const at = page.indexOf(SECTION);
		expect(at).toBeGreaterThan(page.indexOf('<section class="rynke-rules">'));
		expect(page.indexOf('<section class="rynke-rules">')).toBeGreaterThan(0);
		expect(at).toBeLessThan(page.indexOf("<h2>Deine Fahrten</h2>"));
	});

	it("puts an empty push_endpoint into the sign-out form", async () => {
		const { page } = await get("/me", await sessionCookie(ctx, ATHLETE_A));
		expect(page).toContain(
			'<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value="">',
		);
	});

	it("is not on /", async () => {
		const { page } = await get("/");
		expect(page).not.toContain('id="notifications"');
	});
});

describe("GET /offline", () => {
	it.each([
		["de", "Keine Verbindung", "RynkePoints braucht eine Internetverbindung."],
		["en", "No connection", "RynkePoints needs an internet connection."],
	])("renders the notice in %s", async (lang, title, body) => {
		const { res, page } = await get(`/offline?lang=${lang}`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-cache");
		expect(page).toContain(`<html lang="${lang}">`);
		expect(page).toContain(`<title>${title}</title>`);
		expect(page).toContain(`<h1>${title}</h1>`);
		expect(page).toContain(body);
		expect(page).toContain("powered-by-strava.svg");
	});

	it.each([
		[undefined, "en", "No connection"],
		["xx", "en", "No connection"],
		[undefined, "de-DE", "Keine Verbindung"],
	])("with lang %s follows Accept-Language %s", async (lang, accept, title) => {
		const path = lang ? `/offline?lang=${lang}` : "/offline";
		const res = await handleFetch(
			request(path, { acceptLanguage: accept }),
			ctx,
		);
		expect(await res.text()).toContain(`<h1>${title}</h1>`);
	});
});

describe("GET /notification-text", () => {
	it.each([
		["de", "Neue Rynke – tippe zum Ansehen"],
		["en", "New Rynke – tap to view"],
	])("answers the %s text as JSON", async (lang, body) => {
		const res = await handleFetch(
			request(`/notification-text?lang=${lang}`),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-cache");
		expect(res.headers.get("Content-Type")).toMatch(/^application\/json/);
		expect(await res.json()).toEqual({ title: "RynkePoints", body });
	});
});

describe("GET /me/notification-text (issue #45)", () => {
	async function riderText(lang = "de") {
		const res = await handleFetch(
			request(`/me/notification-text?lang=${lang}`, {
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(res.headers.get("Set-Cookie")).toBeNull();
		return {
			status: res.status,
			body:
				res.status === 200
					? ((await res.json()) as { title: string; body: string })
					: null,
		};
	}

	async function seedRise(training: number, team: number) {
		await env.DB.prepare(
			"INSERT INTO rynke_rises (athlete_id, training_rynke, team_rynke, risen_at) VALUES (?, ?, ?, ?)",
		)
			.bind(ATHLETE_A, training, team, NOW)
			.run();
	}

	const IN = {
		trainingRynke: 262,
		trainingMissing: 0,
		teamRynke: 25,
		teamMissing: 0,
		trainingWithoutVirtual: 262,
		virtualShareMissing: 0,
		qualified: true,
	};

	it("names the new Rynke and what is still missing", async () => {
		await seedBalance(ATHLETE_A, {
			trainingRynke: 34,
			trainingMissing: 216,
			teamRynke: 23,
			teamMissing: 2,
			trainingWithoutVirtual: 34,
			virtualShareMissing: 133,
		});
		await seedRise(3, 0);
		expect(await riderText()).toEqual({
			status: 200,
			body: {
				title: "RynkePoints",
				body: "Neue Rynke: +3 Trainingsrynke. Dir fehlen noch 216 Trainingsrynke und 2 Teamrynke.",
			},
		});
		expect((await riderText("en")).body?.body).toBe(
			"New Rynke: +3 Training Rynke. You still need 216 Training Rynke and 2 Team Rynke.",
		);
	});

	it("names only the new Rynke once nothing is missing", async () => {
		await seedBalance(ATHLETE_A, IN);
		await seedRise(12, 1);
		expect((await riderText()).body?.body).toBe(
			"Neue Rynke: +12 Trainingsrynke und +1 Teamrynke.",
		);
	});

	it("names the outdoor share once the rider has a virtual ride", async () => {
		await seedBalance(ATHLETE_A, {
			...IN,
			trainingWithoutVirtual: 160,
			virtualShareMissing: 7,
			qualified: false,
		});
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			sport_type: "VirtualRide",
			result: { counts: true, distanceRynke: 102, isVirtual: true },
		});
		await seedRise(0, 1);
		expect((await riderText()).body?.body).toBe(
			"Neue Rynke: +1 Teamrynke. Dir fehlen noch 7 Trainingsrynke aus Fahrten draußen (nicht virtuell).",
		);
	});

	it("has nothing to add without a stored rise", async () => {
		await seedBalance(ATHLETE_A, IN);
		expect(await riderText()).toEqual({ status: 204, body: null });
	});

	it("refuses a request without a session", async () => {
		const res = await handleFetch(
			request("/me/notification-text?lang=de"),
			ctx,
		);
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("");
	});
});

describe("the cached texts hold no rider data (SC-007, SC-008)", () => {
	it.each(["/offline?lang=de", "/notification-text?lang=de"])(
		"%s is the same with a session and never reads D1",
		async (path) => {
			// Issued 10 days ago, so a page would renew it.
			const cookies = cookiePair(
				await createSessionCookie(ATHLETE_A, NOW - 10 * 86400, ctx.env),
			);
			const noDb = withoutDb(ctx);
			const anonymous = await handleFetch(request(path), noDb);
			const signedIn = await handleFetch(request(path, { cookies }), noDb);
			const body = await signedIn.text();
			expect(body).toBe(await anonymous.text());
			expect([...signedIn.headers]).toEqual([...anonymous.headers]);
			expect(signedIn.headers.get("Set-Cookie")).toBeNull();
			expect(body).not.toContain(firstNameFor(ATHLETE_A));
		},
	);
});
