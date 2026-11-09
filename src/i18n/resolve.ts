import { getCookie } from "../http/cookies";
import type { TeamData } from "../teams/types";
import type { Catalogs } from "./catalogs";

// Locale resolution (research R17, feature 026 contracts/locales.md): picked
// language cookie, then the best shipped Accept-Language range, then the team's
// foreign locale for browsers naming only unshipped languages, then the team's
// default locale.

export const LANG_COOKIE = "rp_lang";

interface LanguageRange {
	tag: string;
	q: number;
}

function parseAcceptLanguage(header: string): LanguageRange[] {
	const ranges: LanguageRange[] = [];
	for (const part of header.split(",")) {
		const [range = "", ...params] = part.split(";").map((p) => p.trim());
		const primary = range.split("-")[0]?.toLowerCase() ?? "";
		// Norwegian, Bokmål and Nynorsk all read the Bokmål catalog.
		const tag = primary === "no" || primary === "nn" ? "nb" : primary;
		if (!tag || tag === "*") continue;
		let q = 1;
		for (const param of params) {
			const match = param.match(/^q\s*=\s*(.*)$/i);
			if (match) {
				q = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test(match[1] ?? "")
					? Number(match[1])
					: 0;
			}
		}
		if (q > 0) ranges.push({ tag, q });
	}
	return ranges;
}

export function resolveLocale(
	request: Request,
	catalogs: Catalogs,
	team: Pick<TeamData, "defaultLocale" | "foreignLocale">,
): string {
	const picked = getCookie(request, LANG_COOKIE);
	if (picked && Object.hasOwn(catalogs, picked)) return picked;

	const ranges = parseAcceptLanguage(
		request.headers.get("Accept-Language") ?? "",
	);
	let best: LanguageRange | undefined;
	for (const range of ranges) {
		// Strictly greater, so on a tie the range listed first wins.
		if (Object.hasOwn(catalogs, range.tag) && (!best || range.q > best.q)) {
			best = range;
		}
	}
	if (best) return best.tag;
	return ranges.length > 0 ? team.foreignLocale : team.defaultLocale;
}
