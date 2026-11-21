import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, CHANGELOG, parseChangelog } from "../../src/changelog";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { makeCtx, request } from "../support/ctx";

// The changelog (CHANGELOG.md) at `/changelog`, linked from Settings: public,
// newest version first, the entries in English whatever the language
// (constitution, Language).

const ctx = makeCtx();
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const parts = (v: string) => (v.match(SEMVER) ?? []).slice(1).map(Number);
function newer(a: string, b: string): boolean {
	const [x, y] = [parts(a), parts(b)];
	const i = x.findIndex((n, j) => n !== y[j]);
	return i >= 0 && (x[i] as number) > (y[i] as number);
}

describe("parseChangelog", () => {
	it("reads a heading per version and its changes, after the introduction", () => {
		const text = [
			"# Changelog",
			"",
			"What changed.",
			"",
			"<!--",
			"- not a change",
			"-->",
			"",
			"## 1.1.0",
			"",
			"- One change.",
			"- A change that goes",
			"  on in a second line.",
			"",
			"## 1.0.0",
			"- The first.",
			"",
		].join("\n");
		expect(parseChangelog(text)).toEqual([
			{
				version: "1.1.0",
				changes: ["One change.", "A change that goes on in a second line."],
			},
			{ version: "1.0.0", changes: ["The first."] },
		]);
	});

	it.each(["### 1.0.1", "* A change.", "A change without its dash."])(
		"refuses %s under a version",
		(line) => {
			expect(() =>
				parseChangelog(`## 1.0.0\n\n- A change.\n${line}\n`),
			).toThrow("CHANGELOG.md line 4");
		},
	);
});

describe("CHANGELOG", () => {
	it("starts with the version package.json names", () => {
		expect(APP_VERSION).toBe(pkg.version);
	});

	it("lists semver versions once each, newest first, each with changes", () => {
		for (const { version, changes } of CHANGELOG) {
			expect(version).toMatch(SEMVER);
			expect(changes.length, version).toBeGreaterThan(0);
			for (const change of changes) {
				// Plain sentences: the page shows no Markdown formatting.
				expect(change, version).not.toMatch(/[*`[<]/);
			}
		}
		for (let i = 1; i < CHANGELOG.length; i++) {
			const [prev, next] = [CHANGELOG[i - 1], CHANGELOG[i]];
			expect(newer(prev?.version ?? "", next?.version ?? ""), `${i}`).toBe(
				true,
			);
		}
	});
});

describe("GET /changelog", () => {
	it.each(["de", "en"] as const)(
		"is public and lists every version in %s",
		async (lang) => {
			const res = await handleFetch(
				request("/changelog", { acceptLanguage: lang }),
				ctx,
			);
			expect(res.status).toBe(200);
			const page = await res.text();
			const catalog = CATALOGS[lang];
			expect(page).toContain(
				`<h1>${escapeHtml(catalog["changelog.title"])}</h1>`,
			);
			for (const { version, changes } of CHANGELOG) {
				expect(page).toContain(
					`<h2>${escapeHtml(catalog["changelog.version"].replace("{version}", version))}</h2>`,
				);
				for (const change of changes) {
					expect(page).toContain(`<li>${escapeHtml(change)}</li>`);
				}
			}
			expect(page).toContain('<ul class="changelog-changes" lang="en">');
		},
	);
});
