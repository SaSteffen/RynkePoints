import { describe, expect, it } from "vitest";
import { CATALOGS, type Catalogs } from "../../src/i18n/catalogs";
import { resolveLocale } from "../../src/i18n/resolve";

function req(headers: Record<string, string>) {
	return new Request("https://rynke.test/", { headers });
}

describe("resolveLocale", () => {
	it.each([
		["no Accept-Language", {}],
		["an empty header", { "Accept-Language": "" }],
		[
			"German as the only provided language",
			{ "Accept-Language": "da,de;q=0.5" },
		],
		["German preferred", { "Accept-Language": "de-DE,en;q=0.5" }],
		["German weighted higher", { "Accept-Language": "en;q=0.5,de;q=0.8" }],
		["only q=0", { "Accept-Language": "en;q=0" }],
		["a wildcard", { "Accept-Language": "*" }],
		["a malformed weight", { "Accept-Language": "en;q=abc" }],
	])("serves German for %s", (_label, headers) => {
		expect(resolveLocale(req(headers), CATALOGS)).toBe("de");
	});

	it.each([
		["English preferred", "en-US,en;q=0.9,de;q=0.8"],
		["mixed-case tags", "EN-gb"],
		["English listed, German not", "da,en;q=0.3"],
		["only unsupported languages", "da"],
		["only unsupported regional languages", "fr-CH, fr;q=0.9"],
		["a tie, English listed first", "en;q=0.8,de;q=0.8"],
	])("serves English for %s", (_label, header) => {
		expect(resolveLocale(req({ "Accept-Language": header }), CATALOGS)).toBe(
			"en",
		);
	});

	it.each([
		["rp_lang=en", "de", "en"],
		["rp_lang=de", "en", "de"],
		["rp_lang=fr", "en", "en"],
	])(
		"with cookie %s and Accept-Language %s → %s",
		(cookie, header, expected) => {
			expect(
				resolveLocale(
					req({ Cookie: cookie, "Accept-Language": header }),
					CATALOGS,
				),
			).toBe(expected);
		},
	);

	it("falls back to German for an unknown cookie and no header", () => {
		expect(resolveLocale(req({ Cookie: "rp_lang=fr" }), CATALOGS)).toBe("de");
	});

	it("finds rp_lang among other cookies", () => {
		expect(
			resolveLocale(
				req({ Cookie: "rp_session=900001.1.sig; rp_lang=en" }),
				CATALOGS,
			),
		).toBe("en");
	});

	it("accepts any locale in the registry", () => {
		const extended: Catalogs = { ...CATALOGS, qps: CATALOGS.de };
		expect(resolveLocale(req({ Cookie: "rp_lang=qps" }), extended)).toBe("qps");
		expect(resolveLocale(req({ Cookie: "rp_lang=qps" }), CATALOGS)).toBe("de");
	});
});
