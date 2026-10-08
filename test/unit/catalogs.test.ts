import { describe, expect, it } from "vitest";
import {
	CATALOGS,
	DEFAULT_LOCALE,
	FOREIGN_LOCALE,
} from "../../src/i18n/catalogs";
import { de } from "../../src/i18n/messages/de";
import { en } from "../../src/i18n/messages/en";
import { REASON_CODES, UNKNOWN_FIGURE_CODES } from "../../src/rynke/rides";
import { TEAM_EVENT_KINDS } from "../../src/rynke/team-events";
import { CYCLING_SPORT_TYPES } from "../../src/strava/activity";

// Every ID in specs/001-strava-connect-webhook/contracts/messages.md and
// specs/005-rider-view/contracts/messages.md and
// specs/008-strava-ride-names/contracts/messages.md and
// specs/010-pwa-notifications/contracts/messages.md and
// specs/004-roles-and-consent/contracts/re-consent.md.
const CONTRACT_IDS = [
	"meta.languageName",
	"meta.intlLocale",
	"app.name",
	"brand.connectWithStrava.src",
	"brand.connectWithStrava.alt",
	"brand.poweredByStrava.src",
	"brand.poweredByStrava.alt",
	"brand.viewOnStrava",
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
	"landing.notifications",
	"consent.heading",
	"consent.organisers",
	"consent.team",
	"consent.required",
	"consent.write",
	"consent.agree",
	"me.title",
	"me.greeting",
	"me.status.connected",
	"me.status.needsReconnect",
	"me.reconnect",
	"me.scope.readAll",
	"me.scope.sharedOnly",
	"me.scope.write",
	"me.scope.noWrite",
	"me.changePermissions",
	"me.consent.heading",
	"me.consent.accepted",
	"me.consent.none",
	"me.consent.renew.heading",
	"me.consent.renew.leave",
	"me.import.done",
	"me.recent.heading",
	"me.recent.empty",
	"me.recent.col.date",
	"me.recent.col.distance",
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
	"notice.consentRequired.title",
	"notice.consentRequired.body",
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
	// Feature 005, US1
	"rynke.training",
	"rynke.team",
	"rynke.withoutVirtual",
	"rynke.notice.notWorkedOut",
	"rynke.summary.heading",
	"rynke.summary.ofTarget",
	"rynke.summary.missing",
	"rynke.summary.reached",
	"rynke.verdict.in",
	"rynke.verdict.notYet",
	"rynke.missing.training",
	"rynke.missing.team",
	"rynke.missing.withoutVirtual",
	"rynke.rides.col.status",
	"rynke.rides.col.elevationTotal",
	"rynke.ride.counts",
	"rynke.ride.doesNotCount",
	"rynke.ride.beingEvaluated",
	"rynke.ride.virtual",
	// Feature 005, US2
	"units.percent",
	"rynke.gauges.heading",
	"rynke.gauge.caption",
	"rynke.gauge.reached",
	"rynke.gauge.elevation",
	"rynke.source.distance",
	"rynke.source.elevation",
	// Feature 005, US3a
	"rynke.breakdown.heading",
	"rynke.breakdown.trainingRynke",
	"rynke.breakdown.elevation",
	"rynke.breakdown.elevationNoStep",
	"rynke.breakdown.total",
	"rynke.breakdown.totals",
	// Feature 005, US3b team events
	"rynke.source.team_training",
	"rynke.source.training_weekend_day",
	"rynke.source.technique_training",
	"rynke.breakdown.kind",
	"rynke.events.heading",
	"rynke.events.none",
	"rynke.events.notCounting",
	// Feature 005, US4
	"units.kmh",
	"units.mPerH",
	"units.duration",
	"units.durationMin",
	"rynke.ride.fixHint",
	"rynke.reason.flagged",
	"rynke.reason.pause",
	"rynke.reason.pause.share",
	"rynke.reason.pause.noLimit",
	"rynke.reason.pause.noMovingTime",
	"rynke.reason.manual",
	"rynke.reason.too_slow",
	"rynke.reason.too_slow.noLimit",
	"rynke.reason.too_fast",
	"rynke.reason.too_fast.noLimit",
	"rynke.reason.climbing_rate",
	"rynke.reason.climbing_rate.noLimit",
	"rynke.reason.excluded_sport_type",
	"rynke.reason.outside_window",
	"rynke.reason.outside_window.afterDeadline",
	"rynke.reason.outside_window.afterDeadlineNoDate",
	"rynke.reason.overlap",
	"rynke.reason.overlap.noRide",
	"rynke.reason.unknown",
	"rynke.unknown.elapsed_time",
	"rynke.unknown.manual",
	"rynke.unknown.trainer",
	"rynke.unknown.flagged",
	"rynke.unknown.mayChange",
	// Feature 005, US5
	"rynke.rides.position",
	"rynke.pager.label",
	"rynke.pager.first",
	"rynke.pager.previous",
	"rynke.pager.next",
	"rynke.pager.last",
	// Feature 005, US6
	"rynke.notice.updating",
	"rynke.notice.importing",
	"rynke.rules.heading",
	"rynke.rules.version",
	"rynke.rules.window",
	"rynke.rules.windowDeadline",
	"rynke.rules.handout",
	// Feature 010, US1
	"install.button",
	"install.ios",
	"install.dismiss",
	"offline.title",
	"offline.body",
	"push.body",
	// Feature 010, US3
	"notifications.heading",
	"notifications.explain",
	"notifications.on",
	"notifications.off",
	"notifications.turnOn",
	"notifications.turnOff",
	"notifications.blocked",
	"notifications.needsHomeScreen",
	"notifications.unsupported",
	"notifications.failed",
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

	it("has no placeholder in the notification text (010 SC-008)", () => {
		expect(catalog["push.body"]).toBeDefined();
		expect(catalog["push.body"]).not.toContain("{");
	});

	it("names a formatting locale Intl supports", () => {
		const tag = catalog["meta.intlLocale"] ?? "";
		expect(new Intl.NumberFormat(tag).resolvedOptions().locale).toBe(tag);
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

	it("explains every reason and every unknown figure (SC-003, FR-062)", () => {
		for (const [locale, catalog] of catalogs) {
			for (const code of REASON_CODES) {
				expect(Object.keys(catalog), locale).toContain(`rynke.reason.${code}`);
			}
			for (const code of UNKNOWN_FIGURE_CODES) {
				expect(Object.keys(catalog), locale).toContain(`rynke.unknown.${code}`);
			}
		}
	});

	it("names every team-event kind (FR-062)", () => {
		for (const [locale, catalog] of catalogs) {
			for (const kind of TEAM_EVENT_KINDS) {
				expect(Object.keys(catalog), locale).toContain(`rynke.source.${kind}`);
			}
		}
	});

	it("carries the German source texts", () => {
		expect(de["landing.backups"]).toBe(
			"Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters und verschwinden danach automatisch.",
		);
		expect(de["brand.connectWithStrava.alt"]).toBe("Mit Strava verbinden");
	});

	it("names the two kinds of Rynke as the team does (FR-060)", () => {
		expect(de["rynke.training"]).toBe("Trainingsrynke");
		expect(de["rynke.team"]).toBe("Teamrynke");
		expect(en["rynke.training"]).toBe("Training Rynke");
		expect(en["rynke.team"]).toBe("Team Rynke");
	});

	it("heads the ride table with all the rider's rides (US5)", () => {
		expect(de["me.recent.heading"]).toBe("Deine Fahrten");
		expect(en["me.recent.heading"]).toBe("Your rides");
	});

	it("keeps Strava's exact attribution wording in every locale", () => {
		expect(de["brand.poweredByStrava.alt"]).toBe("Powered by Strava");
		expect(en["brand.poweredByStrava.alt"]).toBe("Powered by Strava");
	});

	it("keeps Strava's link text in English in every locale (008 FR-009)", () => {
		for (const catalog of Object.values(CATALOGS)) {
			expect(catalog["brand.viewOnStrava"]).toBe("View on Strava");
		}
	});
});
