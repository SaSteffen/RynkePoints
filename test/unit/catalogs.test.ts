import { describe, expect, it } from "vitest";
import {
	CATALOGS,
	DEFAULT_LOCALE,
	FOREIGN_LOCALE,
} from "../../src/i18n/catalogs";
import { de } from "../../src/i18n/messages/de";
import { en } from "../../src/i18n/messages/en";
import { CYCLING_SPORT_TYPES } from "../../src/strava/activity";

// Every ID in specs/001-strava-connect-webhook/contracts/messages.md.
const CONTRACT_IDS = [
	"meta.languageName",
	"meta.intlLocale",
	"app.name",
	"brand.connectWithStrava.src",
	"brand.connectWithStrava.alt",
	"brand.poweredByStrava.src",
	"brand.poweredByStrava.alt",
	"layout.switcher.label",
	"layout.logout",
	"landing.title",
	"landing.intro",
	"landing.who",
	"club.linkText",
	"landing.dataRead",
	"landing.private",
	"landing.purpose",
	"landing.leave",
	"landing.backups",
	"landing.cookies",
	"me.title",
	"me.greeting",
	"me.status.connected",
	"me.status.needsReconnect",
	"me.reconnect",
	"me.scope.readAll",
	"me.scope.sharedOnly",
	"me.import.running",
	"me.import.done",
	"me.recent.heading",
	"me.recent.empty",
	"me.recent.col.date",
	"me.recent.col.sport",
	"me.recent.col.distance",
	"me.recent.col.elevation",
	"me.disconnect.button",
	"units.km",
	"units.m",
	"sport.Ride",
	"sport.MountainBikeRide",
	"sport.GravelRide",
	"sport.EBikeRide",
	"sport.EMountainBikeRide",
	"sport.VirtualRide",
	"disconnect.title",
	"disconnect.explain",
	"disconnect.confirm",
	"disconnect.cancel",
	"notice.retry",
	"notice.backToStart",
	"notice.expired.title",
	"notice.expired.body",
	"notice.denied.title",
	"notice.denied.body",
	"notice.teamFull.title",
	"notice.teamFull.body",
	"notice.failed.title",
	"notice.failed.body",
	"notice.notMember.title",
	"notice.notMember.body",
	"notice.nothingStored",
	"notice.stravaBusy.title",
	"notice.stravaBusy.body",
	"notice.deleted.title",
	"notice.deleted.body",
	"notice.revokeFailed.body",
	"error.notFound.title",
	"error.notFound.body",
	"error.forbidden.title",
	"error.forbidden.body",
];

const placeholders = (text: string) =>
	[...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const catalogs = Object.entries(CATALOGS) as [string, Record<string, string>][];

describe("catalog registry", () => {
	it("ships de and en, German first", () => {
		expect(DEFAULT_LOCALE).toBe("de");
		expect(FOREIGN_LOCALE).toBe("en");
		expect(Object.keys(CATALOGS)).toEqual(["de", "en"]);
	});
});

describe.each(catalogs)("catalog %s", (_locale, catalog) => {
	it("has exactly the keys of de", () => {
		expect(Object.keys(catalog).sort()).toEqual(Object.keys(de).sort());
	});

	it("has no empty values", () => {
		for (const [id, text] of Object.entries(catalog)) {
			expect(text.trim(), id).not.toBe("");
		}
	});

	it("uses the same placeholders as de", () => {
		for (const [id, text] of Object.entries(de)) {
			expect(placeholders(catalog[id] ?? ""), id).toEqual(placeholders(text));
		}
	});

	it("names a formatting locale Intl accepts", () => {
		expect(
			() => new Intl.NumberFormat(catalog["meta.intlLocale"]),
		).not.toThrow();
		expect(
			Intl.NumberFormat.supportedLocalesOf([catalog["meta.intlLocale"] ?? ""]),
		).toHaveLength(1);
	});
});

describe("catalog contents", () => {
	it("labels the switcher with unique language names", () => {
		const names = catalogs.map(([, c]) => c["meta.languageName"]);
		expect(names).toEqual(["Deutsch", "English"]);
		expect(new Set(names).size).toBe(names.length);
	});

	it("matches the contract inventory", () => {
		expect(Object.keys(de).sort()).toEqual([...CONTRACT_IDS].sort());
	});

	it("has a message for every cycling sport type", () => {
		for (const type of CYCLING_SPORT_TYPES) {
			expect(Object.keys(de)).toContain(`sport.${type}`);
		}
	});

	it("carries the German source texts", () => {
		expect(de["landing.backups"]).toBe(
			"Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters und verschwinden danach automatisch.",
		);
		expect(de["brand.connectWithStrava.alt"]).toBe("Mit Strava verbinden");
	});

	it("keeps Strava's exact attribution wording in every locale", () => {
		expect(de["brand.poweredByStrava.alt"]).toBe("Powered by Strava");
		expect(en["brand.poweredByStrava.alt"]).toBe("Powered by Strava");
	});
});
