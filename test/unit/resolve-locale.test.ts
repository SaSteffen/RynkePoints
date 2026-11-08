import { describe, expect, it } from "vitest";
import { CATALOGS, type Catalogs } from "../../src/i18n/catalogs";
import { resolveLocale } from "../../src/i18n/resolve";

// Locale resolution (feature 026 contracts/locales.md › Resolution): cookie, then
// the best shipped range, then the team's foreign locale, then its default.

/** The founding team's languages: German by default, English for strangers. */
const FOUNDING = { defaultLocale: "de", foreignLocale: "en" } as const;
/** A team that speaks English to everyone. */
const ENGLISH = { defaultLocale: "en", foreignLocale: "en" } as const;

/** Shipped locales including Norwegian, whatever the registry ships today. */
const WITH_NB: Catalogs = { ...CATALOGS, nb: CATALOGS.en };

function req(headers: Record<string, string>) {
	return new Request("https://rynke.test/", { headers });
}

describe("resolveLocale for the founding team (unchanged from before)", () => {
	it.each([
		["no Accept-Language", {}],
		["an empty header", { "Accept-Language": "" }],
		[
			"German as the only shipped language",
			{ "Accept-Language": "es,de;q=0.5" },
		],
		["German preferred", { "Accept-Language": "de-DE,en;q=0.5" }],
		["German weighted higher", { "Accept-Language": "en;q=0.5,de;q=0.8" }],
		["only q=0", { "Accept-Language": "en;q=0" }],
		["a wildcard", { "Accept-Language": "*" }],
		["a malformed weight", { "Accept-Language": "en;q=abc" }],
	])("serves German for %s", (_label, headers) => {
		expect(resolveLocale(req(headers), CATALOGS, FOUNDING)).toBe("de");
	});

	it.each([
		["English preferred", "en-US,en;q=0.9,de;q=0.8"],
		["mixed-case tags", "EN-gb"],
		["English listed, German not", "es,en;q=0.3"],
		["only unshipped languages", "es"],
		["only unshipped regional languages", "pt-BR, pt;q=0.9"],
		["a tie, English listed first", "en;q=0.8,de;q=0.8"],
	])("serves English for %s", (_label, header) => {
		expect(
			resolveLocale(req({ "Accept-Language": header }), CATALOGS, FOUNDING),
		).toBe("en");
	});

	it.each([
		["rp_lang=en", "de", "en"],
		["rp_lang=de", "en", "de"],
		["rp_lang=xx", "en", "en"],
	])(
		"with cookie %s and Accept-Language %s → %s",
		(cookie, header, expected) => {
			expect(
				resolveLocale(
					req({ Cookie: cookie, "Accept-Language": header }),
					CATALOGS,
					FOUNDING,
				),
			).toBe(expected);
		},
	);

	it("falls back to German for an unknown cookie and no header", () => {
		expect(
			resolveLocale(req({ Cookie: "rp_lang=xx" }), CATALOGS, FOUNDING),
		).toBe("de");
	});

	it("finds rp_lang among other cookies", () => {
		expect(
			resolveLocale(
				req({ Cookie: "rp_session=900001.1.sig; rp_lang=en" }),
				CATALOGS,
				FOUNDING,
			),
		).toBe("en");
	});

	it("accepts any locale in the registry", () => {
		const extended: Catalogs = { ...CATALOGS, qps: CATALOGS.de };
		const cookie = req({ Cookie: "rp_lang=qps" });
		expect(resolveLocale(cookie, extended, FOUNDING)).toBe("qps");
		expect(resolveLocale(cookie, CATALOGS, FOUNDING)).toBe("de");
	});
});

describe("resolveLocale per team", () => {
	it("gives a team's default locale when no language is stated", () => {
		expect(resolveLocale(req({}), CATALOGS, ENGLISH)).toBe("en");
	});

	it("gives a team's foreign locale for only unshipped languages", () => {
		const team = { defaultLocale: "en", foreignLocale: "de" } as const;
		expect(
			resolveLocale(req({ "Accept-Language": "es" }), CATALOGS, team),
		).toBe("de");
	});

	it("prefers a shipped browser language over the team's default", () => {
		expect(
			resolveLocale(req({ "Accept-Language": "de" }), CATALOGS, ENGLISH),
		).toBe("de");
	});
});

describe("Norwegian", () => {
	it.each([
		["nb", "nb"],
		["no", "nb"],
		["nn-NO", "nb"],
		["nb-NO,en;q=0.5", "nb"],
		["no;q=0.4,de;q=0.9", "de"],
	])("reads %s as %s", (header, expected) => {
		expect(
			resolveLocale(req({ "Accept-Language": header }), WITH_NB, FOUNDING),
		).toBe(expected);
	});
});
