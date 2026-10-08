import { STYLE } from "../../src/http/style";

// The stylesheet read as rules, for the tests that check it without a browser
// (feature 011 research R15).

export interface Rule {
	/** The enclosing `@media` condition, `null` at the top level. */
	media: string | null;
	selectors: string[];
	decls: Record<string, string>;
}

/** The style rules, one `@media` level deep, like `STYLE` is written. */
export function rules(css: string): Rule[] {
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

export const RULES = rules(STYLE);

/** The declarations for `selector` under `media`, merged in order. */
export function declsOf(
	selector: string,
	media: string | null = null,
): Record<string, string> {
	return Object.assign(
		{},
		...RULES.filter(
			(rule) => rule.media === media && rule.selectors.includes(selector),
		).map((rule) => rule.decls),
	);
}
