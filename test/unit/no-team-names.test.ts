import { describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { TEAMS } from "../../src/teams";

// FR-016 (feature 026 contracts/team-data.md › No team names in code): outside
// src/teams/, no source file under src/ names a registered team, by its ID or
// its display name, in a string literal. Team-specific behaviour comes from a
// field of TeamData or a var. Not names: a team's own content sets
// (src/content/*/<id>.<locale>.ts, team data like src/teams/), and paths under
// a team's art folder `/teams/<id>/`, which only that team's data points to.
// The catalogs are checked message by message.

declare global {
	interface ImportMeta {
		glob(
			pattern: string,
			options: { query: "?raw"; import: "default"; eager: true },
		): Record<string, string>;
	}
}

const SOURCES = import.meta.glob("../../src/**/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

const IDS = TEAMS.map((team) => team.id);
const NAMES = TEAMS.map((team) => team.name);

function isOwnContent(file: string): boolean {
	return IDS.some((id) =>
		new RegExp(`/src/content/[^/]+/${id}\\.[a-z]+\\.ts$`).test(file),
	);
}

const exempt = (file: string) =>
	file.includes("/src/teams/") ||
	file.includes("/src/i18n/messages/") ||
	isOwnContent(file);

/** The source without comments; `//` after `:` (a URL) isn't one. */
function withoutComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const LITERALS = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

/** The team a text names, if any. */
function namedTeam(text: string): string | null {
	const plain = text.replace(/\/teams\/[a-z]+\//g, "/teams/");
	for (const name of NAMES) if (plain.includes(name)) return name;
	for (const id of IDS) if (new RegExp(`\\b${id}\\b`).test(plain)) return id;
	return null;
}

describe("no team names in code (FR-016)", () => {
	it("finds the app's source files and every team", () => {
		expect(Object.keys(SOURCES).length).toBeGreaterThanOrEqual(30);
		expect(IDS.length).toBeGreaterThanOrEqual(2);
	});

	it("names no team in a string literal outside src/teams/", () => {
		const found: string[] = [];
		for (const [file, source] of Object.entries(SOURCES)) {
			if (exempt(file)) continue;
			for (const literal of withoutComments(source).match(LITERALS) ?? []) {
				const team = namedTeam(literal);
				if (team) found.push(`${file}: ${team} in ${literal.slice(0, 80)}`);
			}
		}
		expect(found).toEqual([]);
	});

	it("names no team in a catalog message", () => {
		const found: string[] = [];
		for (const [locale, catalog] of Object.entries(CATALOGS)) {
			for (const [key, value] of Object.entries(catalog)) {
				const team = namedTeam(JSON.stringify(value));
				if (team) found.push(`${locale} ${key}: ${team}`);
			}
		}
		expect(found).toEqual([]);
	});

	it("catches a team's name and ID, but not an art path", () => {
		expect(namedTeam(`"${NAMES[0]}"`)).toBe(NAMES[0]);
		expect(namedTeam(`"${IDS[1]}"`)).toBe(IDS[1]);
		expect(namedTeam(`"/teams/${IDS[1]}/coin/front.svg"`)).toBeNull();
	});
});
