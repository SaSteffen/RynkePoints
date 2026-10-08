import { describe, expect, it } from "vitest";
import { html } from "../../src/http/html";
import { CATALOGS, type Catalog, type Catalogs } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";

const de = createI18n("de", CATALOGS);
const en = createI18n("en", CATALOGS);

describe("t", () => {
	it("substitutes params", () => {
		expect(de.t("me.greeting", { firstName: "Testrider A" })).toBe(
			"Hallo Testrider A! 🦧",
		);
		expect(en.t("me.greeting", { firstName: "Testrider A" })).toBe(
			"Hi Testrider A! 🦧",
		);
	});

	it("throws on a missing param", () => {
		expect(() => de.t("me.greeting")).toThrow();
		expect(() => de.t("me.greeting", {})).toThrow();
	});

	it("falls back to the German text for a missing key", () => {
		const { "me.title": _, ...partial } = CATALOGS.en;
		const catalogs: Catalogs = { ...CATALOGS, en: partial as Catalog };
		expect(createI18n("en", catalogs).t("me.title")).toBe("Deine RynkePoints");
	});
});

describe("tHtml", () => {
	it("keeps SafeHtml params as markup", () => {
		const out = de.tHtml("landing.who", {
			clubLink: html`<a href="x">Club</a>`,
		});
		expect(String(out)).toBe(
			'Mitmachen können nur Mitglieder <a href="x">Club</a>.',
		);
	});

	it("escapes plain-string params", () => {
		const out = de.tHtml("me.greeting", { firstName: "<b>A</b>" });
		expect(String(out)).toBe("Hallo &lt;b&gt;A&lt;/b&gt;! 🦧");
	});

	it("escapes the message text itself", () => {
		const catalogs: Catalogs = {
			...CATALOGS,
			de: { ...CATALOGS.de, "me.title": "A & <B>" },
		};
		expect(String(createI18n("de", catalogs).tHtml("me.title"))).toBe(
			"A &amp; &lt;B&gt;",
		);
	});
});

describe("formatting", () => {
	it("formats numbers for the locale", () => {
		expect(de.formatNumber(42.195, { fractionDigits: 1 })).toBe("42,2");
		expect(en.formatNumber(42.195, { fractionDigits: 1 })).toBe("42.2");
		expect(de.formatNumber(1234, { fractionDigits: 0 })).toBe("1.234");
		expect(en.formatNumber(1234, { fractionDigits: 0 })).toBe("1,234");
	});

	it("formats dates as the UTC wall-clock date", () => {
		expect(de.formatDate("2026-10-06T07:30:00Z")).toBe("06.10.2026");
		expect(en.formatDate("2026-10-06T07:30:00Z")).toBe("06/10/2026");
		expect(de.formatDate("2026-10-06T23:30:00Z")).toBe("06.10.2026");
	});

	it("formats times as the UTC wall-clock time", () => {
		expect(de.formatTime("2026-10-06T08:00:00Z")).toBe("08:00");
		expect(en.formatTime("2026-10-06T08:00:00Z")).toBe("08:00");
		expect(de.formatTime("2026-10-06T17:05:00Z")).toBe("17:05");
		expect(en.formatTime("2026-10-06T17:05:00Z")).toBe("17:05");
	});
});

describe("locales", () => {
	it("lists every catalog in registry order", () => {
		expect(de.locales).toEqual([
			{ locale: "de", languageName: "Deutsch" },
			{ locale: "en", languageName: "English" },
		]);
		expect(de.locale).toBe("de");
	});
});
