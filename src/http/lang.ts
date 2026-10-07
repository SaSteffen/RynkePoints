import type { Ctx } from "../ctx";
import type { I18n } from "../i18n/i18n";
import { LANG_COOKIE } from "../i18n/resolve";
import { forbidden } from "./errors";
import { isNoticeId } from "./notice";
import { isSameOrigin } from "./session";

// The language switcher's target (contracts/http-routes.md, research R18).
// The picked language lives only in the rp_lang cookie; nothing touches D1.

const LANG_COOKIE_MAX_AGE = 365 * 24 * 3600;
const NEXT_PATHS = new Set(["/", "/me", "/me/disconnect"]);

/** Only known rider-facing GET paths; anything else becomes `/`. */
export function safeNext(next: string | null): string {
	if (next === null) return "/";
	if (NEXT_PATHS.has(next)) return next;
	// The rider page's table page, so the switch keeps it (feature 005 FR-046).
	if (/^\/me\?page=[1-9][0-9]{0,3}$/.test(next)) return next;
	const notice = next.match(/^\/notice\/([a-z-]+)$/);
	if (notice?.[1] && isNoticeId(notice[1])) return next;
	return "/";
}

export async function handleLang(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(i18n, "/");
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		form = new FormData();
	}
	const lang = form.get("lang");
	const next = form.get("next");
	const headers = new Headers({
		Location: safeNext(typeof next === "string" ? next : null),
	});
	if (typeof lang === "string" && Object.hasOwn(ctx.catalogs, lang)) {
		headers.set(
			"Set-Cookie",
			`${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax; Secure; HttpOnly`,
		);
	}
	return new Response(null, { status: 303, headers });
}
