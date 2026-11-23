import { env } from "cloudflare:test";
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
import { installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";

// Admin › Rider und Rollen (feature 045 US1, US2, US4, US5; contracts/pages.md):
// the listed riders by role, the guests, the counts, the red line, the search
// and the one dialog. Synthetic riders only.

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const DAY = "04.11.2026";
const de = CATALOGS.de;
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;
const GUEST = "900009";

async function page(query = "", athleteId = ADMIN) {
	const res = await handleFetch(
		request(`/admin/riders${query}`, {
			cookies: await sessionCookie(ctx, athleteId),
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

function section(text: string, heading: string): string {
	const start = text.indexOf(`<h2>${escapeHtml(heading)}</h2>`);
	expect(start).toBeGreaterThan(-1);
	return text.slice(start, text.indexOf("</section>", start));
}

/** A row's markup, its facts template included. */
function rowOf(text: string, name: string): string {
	const start = text.indexOf(`<li data-name="${name}">`);
	expect(start).toBeGreaterThan(-1);
	return text.slice(start, text.indexOf("</li>", start));
}

function dialog(text: string): string {
	const start = text.indexOf('<dialog class="role-sheet"');
	expect(start).toBeGreaterThan(-1);
	return text.slice(start, text.indexOf("</dialog>", start));
}

function withoutNote(listed: number, waiting: number, blocked: number) {
	return escapeHtml(
		de["admin.roles.without.note"]
			.replace("{listed}", String(listed))
			.replace("{waiting}", String(waiting))
			.replace("{blocked}", String(blocked)),
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ADMIN,
		administrator: true,
		firstName: "Ada",
	});
});

describe("the tab (US1)", () => {
	it("is the second of two admin views", async () => {
		const text = await page();
		expect(text.match(/class="segmented"/g)).toHaveLength(2);
		expect(text).toContain(
			`<a class="segmented" href="/admin/riders" aria-current="true">`,
		);
		expect(text).toContain(escapeHtml(de["admin.switch.riders"]));
		expect(text).not.toContain('class="segmented" href="/admin/roles"');
	});

	it("has the search over the page and its hidden empty line", async () => {
		const text = await page();
		expect(text).toContain("data-role-search");
		expect(text).toContain(
			`<p class="settings-note" data-role-search-none hidden>${escapeHtml(de["admin.roles.searchNone"])}</p>`,
		);
	});
});

describe("the lists (US1, FR-004)", () => {
	beforeEach(async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			firstName: "Olga",
			organiser: true,
		});
		await seedRider(ctx, { athleteId: ATHLETE_C, firstName: "Fiona" });
		await seedRider(ctx, {
			athleteId: "900011",
			firstName: "Older",
			consentVersion: 1,
		});
		await seedRider(ctx, {
			athleteId: "900012",
			firstName: "Uwe",
			consentVersion: null,
		});
	});

	it("lists each listed rider once, in the section of their role", async () => {
		const text = await page();
		for (const name of ["ada", "olga", "fiona", "older"]) {
			expect(text.split(`<li data-name="${name}">`)).toHaveLength(2);
		}
		expect(section(text, de["admin.roles.admins"])).toContain("Ada");
		const orga = section(text, de["admin.roles.orga"]);
		expect(orga).toContain("Olga");
		expect(orga).not.toContain("Ada");
		expect(orga).toContain(escapeHtml(de["admin.roles.orgaNote"]));
		const without = section(text, de["admin.roles.without.heading"]);
		expect(without).toContain("Fiona");
		expect(without).toContain("Older");
		expect(text).not.toContain("Uwe");
	});

	it("puts Ohne Rolle in the second column", async () => {
		const text = await page();
		const columns = text.split('<div class="settings-col">');
		expect(columns).toHaveLength(3);
		expect(columns[1]).toContain(`<h2>${escapeHtml(de["admin.roles.orga"])}`);
		expect(columns[2]).toContain(
			`<h2>${escapeHtml(de["admin.roles.without.heading"])}`,
		);
	});

	it("counts the listed, the waiting and the blocked under Ohne Rolle", async () => {
		await env.DB.prepare(
			"INSERT INTO blocked_athletes (athlete_id) VALUES (777123), (777124)",
		).run();
		const text = await page();
		expect(section(text, de["admin.roles.without.heading"])).toContain(
			withoutNote(4, 1, 2),
		);
		expect(text).not.toContain("777123");
	});

	it("says so when everyone listed has a role", async () => {
		await env.DB.prepare(
			"UPDATE riders SET organiser = 1 WHERE athlete_id IN (?, ?)",
		)
			.bind(ATHLETE_C, "900011")
			.run();
		expect(section(await page(), de["admin.roles.without.heading"])).toContain(
			escapeHtml(de["admin.roles.without.empty"]),
		);
	});

	it("shows since when a rider has their role", async () => {
		await env.DB.prepare(
			"UPDATE riders SET role_since = ? WHERE athlete_id = ?",
		)
			.bind(NOW, ATHLETE_B)
			.run();
		expect(rowOf(await page(), "olga")).toContain(
			escapeHtml(de["admin.roles.orgaSince"].replace("{date}", DAY)),
		);
	});
});

describe("the red line (FR-005, FR-015)", () => {
	it.each([
		[
			"a needed reconnect",
			{ status: "needs_reconnect" as const },
			de["admin.riders.status.needs_reconnect"],
		],
		[
			"a pending import",
			{ importStatus: "pending" as const },
			de["admin.riders.attention.import"],
		],
		[
			"a running import",
			{ importStatus: "running" as const },
			de["admin.riders.attention.import"],
		],
		[
			"both",
			{ status: "needs_reconnect" as const, importStatus: "running" as const },
			`${de["admin.riders.status.needs_reconnect"]} · ${de["admin.riders.attention.import"]}`,
		],
	])("says %s in words", async (_what, state, line) => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Bo", ...state });
		expect(rowOf(await page(), "bo")).toContain(
			`<span class="settings-sub is-warn">${escapeHtml(line)}</span>`,
		);
	});

	it("shows in Admins and Orga too, the viewer's own row included", async () => {
		await env.DB.prepare(
			"UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = 1 WHERE athlete_id = ?",
		)
			.bind(ADMIN)
			.run();
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			firstName: "Olga",
			organiser: true,
			importStatus: "running",
		});
		const text = await page();
		expect(rowOf(text, "ada")).toContain("settings-sub is-warn");
		expect(rowOf(text, "olga")).toContain("settings-sub is-warn");
	});

	it("is absent for a rider whose connection is fine", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Bo" });
		expect(rowOf(await page(), "bo")).not.toContain("is-warn");
	});
});

describe("Ändern and the dialog (US2)", () => {
	beforeEach(async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			firstName: "Bo",
			status: "needs_reconnect",
			importStatus: "running",
		});
		await seedRider(ctx, {
			athleteId: ATHLETE_C,
			firstName: "Olga",
			organiser: true,
		});
	});

	it("opens from every row but the viewer's own", async () => {
		const text = await page();
		const bo = rowOf(text, "bo");
		expect(bo).toContain(
			`data-role-open data-athlete="${ATHLETE_B}" data-role="none" data-title="Bo" data-note="${escapeHtml(de["admin.roles.sheet.note"].replace("{name}", "Bo"))}" data-remove="/admin/riders/${ATHLETE_B}/remove">${escapeHtml(de["admin.roles.change"])}</button>`,
		);
		expect(rowOf(text, "olga")).toContain('data-role="orga"');
		const own = rowOf(text, "ada");
		expect(own).toContain(
			`<span class="settings-chip">${escapeHtml(de["admin.roles.you"])}</span>`,
		);
		expect(own).not.toContain("data-role-open");
		expect(text).not.toContain("Rolle geben");
	});

	it("carries each row's facts in order, those needing attention marked", async () => {
		const bo = rowOf(await page(), "bo");
		expect(bo).toContain(
			`<template data-facts><dl class="rider-facts"><div><dt>${escapeHtml(de["admin.riders.status"])}</dt><dd class="warn">${escapeHtml(de["admin.riders.status.needs_reconnect"])}</dd></div><div><dt>${escapeHtml(de["admin.riders.connected"])}</dt><dd>${DAY}</dd></div><div><dt>${escapeHtml(de["admin.riders.checked"])}</dt><dd>${DAY}</dd></div><div><dt>${escapeHtml(de["admin.riders.import"])}</dt><dd class="warn">${escapeHtml(de["admin.riders.import.running"])}</dd></div></dl></template>`,
		);
	});

	it("has the facts, the role, Entfernen, Abbrechen and Speichern", async () => {
		const sheet = dialog(await page());
		expect(sheet).toContain('<form method="post" action="/admin/roles">');
		expect(sheet).toContain('<h2 id="role-sheet-title"></h2>');
		expect(sheet).toContain("<div data-facts></div>");
		expect(sheet).toContain("<div data-role-part>");
		expect(sheet).toContain(
			`<h3>${escapeHtml(de["admin.roles.sheet.role"])}</h3>`,
		);
		expect(sheet.match(/type="radio" name="role"/g)).toHaveLength(3);
		expect(sheet).toContain("data-role-note");
		expect(sheet).toContain(
			`<a class="button-text sheet-remove" data-role-remove>${escapeHtml(de["admin.riders.remove"])}</a>`,
		);
		expect(sheet).toContain(escapeHtml(de["admin.roles.cancel"]));
		expect(sheet).toContain(
			`<button class="button" data-role-save>${escapeHtml(de["admin.roles.save"])}</button>`,
		);
		expect(sheet).not.toContain("Rolle für");
	});

	it("shows no rides, Rynke, tokens or IDs as text (025 FR-019)", async () => {
		await seedBalance(ATHLETE_B, { trainingRynke: 4321, teamRynke: 765 });
		const text = await page();
		expect(text).not.toContain("4321");
		expect(text).not.toContain("4.321");
		expect(text).not.toContain("765");
		const rest = text
			.replaceAll(`data-athlete="${ATHLETE_B}"`, "")
			.replaceAll(`/admin/riders/${ATHLETE_B}/remove`, "");
		expect(rest).not.toContain(String(ATHLETE_B));
		expect(text).not.toContain("access-");
		expect(text).not.toContain("refresh-");
	});
});

describe("the notices (FR-002, FR-013)", () => {
	it.each([
		["?done=removed", de["admin.remove.done.removed"]],
		["?error=unknown", de["admin.remove.error.unknown"]],
		["?error=roleSelf", de["admin.roles.error.self"]],
		["?error=roleUnknown", de["admin.roles.error.unknown"]],
	])("%s", async (query, text) => {
		expect(await page(query)).toContain(escapeHtml(text));
	});

	it("shows an error rather than a done", async () => {
		const text = await page("?done=removed&error=roleUnknown");
		expect(text).toContain(escapeHtml(de["admin.roles.error.unknown"]));
		expect(text).not.toContain(escapeHtml(de["admin.remove.done.removed"]));
	});

	it("ignores unknown codes", async () => {
		const text = await page("?done=%3Cscript%3E&error=toString");
		expect(text).not.toContain('class="notice');
		expect(text).not.toContain("&lt;script");
	});
});

// Feature 041 FR-008: guests in their own section, marked, removable, no role.
describe("guests (US4)", () => {
	beforeEach(async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Bo" });
		await seedRider(ctx, {
			athleteId: ATHLETE_C,
			firstName: "Gia",
			guest: true,
		});
	});

	it("are under Gäste after Orga, marked, with the day they connected", async () => {
		const text = await page();
		const guests = section(text, de["admin.riders.guests.heading"]);
		expect(guests).toContain(
			`<span class="settings-chip">${escapeHtml(de["admin.riders.guest"])}</span>`,
		);
		expect(guests).toContain(
			escapeHtml(de["admin.riders.guest.since"].replace("{date}", DAY)),
		);
		expect(guests).toContain(escapeHtml(de["admin.riders.guests.note"]));
		expect(text.split('<li data-name="gia">')).toHaveLength(2);
		expect(
			text.indexOf(`<h2>${escapeHtml(de["admin.roles.orga"])}`),
		).toBeLessThan(
			text.indexOf(`<h2>${escapeHtml(de["admin.riders.guests.heading"])}`),
		);
		expect(section(text, de["admin.riders.guests.heading"])).toContain("Gia");
	});

	it("aren't counted among the listed or the waiting", async () => {
		expect(await page()).toContain(withoutNote(2, 0, 0));
	});

	it("open the dialog without a role and without the club check", async () => {
		const text = await page();
		const gia = rowOf(text, "gia");
		expect(gia).toContain("data-role-open");
		expect(gia).not.toContain("data-role=");
		expect(gia).toContain(`data-remove="/admin/riders/${ATHLETE_C}/remove"`);
		expect(gia).not.toContain(escapeHtml(de["admin.riders.checked"]));
		expect(dialog(text)).toContain("<div data-role-part>");
	});

	it("show the red line when they must reconnect", async () => {
		await env.DB.prepare(
			"UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = 1 WHERE athlete_id = ?",
		)
			.bind(ATHLETE_C)
			.run();
		expect(rowOf(await page(), "gia")).toContain(
			`<span class="settings-sub is-warn">${escapeHtml(de["admin.riders.status.needs_reconnect"])}</span>`,
		);
	});

	it("have no section when there are none", async () => {
		await env.DB.prepare("DELETE FROM riders WHERE guest = 1").run();
		expect(await page()).not.toContain(
			`<h2>${escapeHtml(de["admin.riders.guests.heading"])}</h2>`,
		);
	});

	it("can be removed, with the guest's own explanation", async () => {
		// No other team holds them here, so the grant is withdrawn (041 R14).
		const fake = installFakeStrava();
		const confirm = await handleFetch(
			request(`/admin/riders/${ATHLETE_C}/remove`, {
				cookies: await sessionCookie(ctx, ADMIN),
			}),
			ctx,
		);
		expect(await confirm.text()).toContain(
			escapeHtml(de["admin.remove.explain.guest"]),
		);
		const res = await handleFetch(
			request(`/admin/riders/${ATHLETE_C}/remove`, {
				form: {},
				cookies: await sessionCookie(ctx, ADMIN),
			}),
			ctx,
		);
		expect(res.headers.get("Location")).toBe("/admin/riders?done=removed");
		expect(fake.revocations).toHaveLength(1);
		fake.restore();
	});
});

describe("a guest viewer (US5)", () => {
	beforeEach(async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Bo" });
		await seedRider(ctx, {
			athleteId: GUEST,
			firstName: "Quirin",
			guest: true,
		});
	});

	it("gets Ändern on every other row and the search", async () => {
		const text = await page("", GUEST);
		expect(rowOf(text, "bo")).toContain("data-role-open");
		expect(rowOf(text, "ada")).toContain("data-role-open");
		const own = rowOf(text, "quirin");
		expect(own).not.toContain("data-role-open");
		expect(own).toContain(escapeHtml(de["admin.roles.you"]));
		expect(own).toContain(escapeHtml(de["admin.riders.guest"]));
		expect(text).toContain("data-role-search");
	});

	it("gets a dialog with facts and Entfernen only", async () => {
		const sheet = dialog(await page("", GUEST));
		expect(sheet).toContain("<div data-facts></div>");
		expect(sheet).toContain("sheet-remove");
		expect(sheet).not.toContain("data-role-part");
		expect(sheet).not.toContain('name="athlete"');
		expect(sheet).not.toContain("data-role-save");
	});

	it("gets the notice of a change without Rückgängig", async () => {
		const text = await page(`?done=orga&athlete=${ATHLETE_B}&from=none`, GUEST);
		expect(text).toContain(
			escapeHtml(de["admin.roles.done.orga"].replace("{name}", "Bo")),
		);
		expect(text).not.toContain(escapeHtml(de["admin.roles.undo"]));
	});

	it("sees that nobody is listed yet when that is so", async () => {
		await env.DB.prepare("DELETE FROM riders WHERE guest = 0").run();
		const text = await page("", GUEST);
		const without = section(text, de["admin.roles.without.heading"]);
		expect(without).toContain(escapeHtml(de["admin.riders.none"]));
		expect(without).toContain(withoutNote(0, 0, 0));
	});
});
