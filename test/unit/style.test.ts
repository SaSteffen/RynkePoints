import { describe, expect, it } from "vitest";
import { STYLE } from "../../src/http/style";

// The stylesheet's phone guarantees, read from its rules since workerd can't
// measure pixels (feature 011 FR-022, FR-023, research R15,
// contracts/pages.md "Control size").

interface Rule {
	/** The enclosing `@media` condition, `null` at the top level. */
	media: string | null;
	selectors: string[];
	decls: Record<string, string>;
}

/** The style rules, one `@media` level deep, like `STYLE` is written. */
function rules(css: string): Rule[] {
	const out: Rule[] = [];
	const block = (body: string, media: string | null) => {
		let at = 0;
		while (at < body.length) {
			const open = body.indexOf("{", at);
			if (open < 0) break;
			const head = body.slice(at, open).trim();
			if (head.startsWith("@media")) {
				let depth = 1;
				let end = open + 1;
				while (depth > 0 && end < body.length) {
					if (body[end] === "{") depth++;
					if (body[end] === "}") depth--;
					end++;
				}
				block(body.slice(open + 1, end - 1), head.slice(6).trim());
				at = end;
				continue;
			}
			const close = body.indexOf("}", open);
			const decls: Record<string, string> = {};
			for (const decl of body.slice(open + 1, close).split(";")) {
				const colon = decl.indexOf(":");
				if (colon < 0) continue;
				decls[decl.slice(0, colon).trim()] = decl.slice(colon + 1).trim();
			}
			out.push({
				media,
				selectors: head
					.split(",")
					.map((s) => s.replace(/\s*>\s*/g, ">").trim()),
				decls,
			});
			at = close + 1;
		}
	};
	block(css, null);
	return out;
}

const RULES = rules(STYLE);
const PHONE_PX = 360;
const WIDE = "(min-width:600px)";

/** The top-level declarations for `selector`, merged in order. */
function declsOf(selector: string): Record<string, string> {
	return Object.assign(
		{},
		...RULES.filter(
			(rule) => rule.media === null && rule.selectors.includes(selector),
		).map((rule) => rule.decls),
	);
}

/** A length in px, or null when it isn't a fixed `px`/`rem` length. */
function px(value: string): number | null {
	const m = value.match(/^(\d+(?:\.\d+)?)(px|rem)$/);
	if (!m) return null;
	return Number(m[1]) * (m[2] === "rem" ? 16 : 1);
}

describe("STYLE", () => {
	it("sets the tap size token to 44 px", () => {
		expect(declsOf(":root")["--rp-tap"]).toBe("44px");
	});

	it.each([
		"nav.app-nav a",
		".icon-button",
		".button",
		".button-outlined",
		".segmented",
		".tap",
		".ride-why>summary",
		"[role=switch]",
		".danger",
		".segmented-group label",
	])("gives %s the 44 px tap height", (selector) => {
		expect(declsOf(selector)["min-height"]).toBe("var(--rp-tap)");
	});

	it("breaks long words in main", () => {
		expect(declsOf("main")["overflow-wrap"]).toBe("anywhere");
	});

	it(`sets no width above ${PHONE_PX} px below 600 px`, () => {
		const wide = RULES.filter((rule) => rule.media !== WIDE).flatMap((rule) =>
			["width", "min-width"].flatMap((prop) => {
				const value = rule.decls[prop];
				const length = value === undefined ? null : px(value);
				return length !== null && length > PHONE_PX
					? [`${rule.selectors.join(",")} ${prop}:${value}`]
					: [];
			}),
		);
		expect(wide).toEqual([]);
	});

	it("keeps the last card above the bottom bar and the home indicator", () => {
		expect(declsOf("body.shell main")["padding-bottom"]).toContain(
			"env(safe-area-inset-bottom)",
		);
	});
});
