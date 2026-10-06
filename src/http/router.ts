import type { Ctx } from "../ctx";
import { createI18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { notFound } from "./errors";
import { handleLang } from "./lang";
import { handleNotice } from "./notice";

// A small path switch (research R13). `/health` and the Strava webhook answer
// in plain English; every other route is rider-facing and gets an I18n for the
// language resolved once per request.

export async function route(request: Request, ctx: Ctx): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;

	if (path === "/health") return new Response("ok");

	const i18n = createI18n(resolveLocale(request, ctx.catalogs), ctx.catalogs);

	if (method === "GET" && path.startsWith("/notice/")) {
		return handleNotice(path.slice("/notice/".length), ctx, i18n);
	}
	if (method === "POST" && path === "/lang") {
		return handleLang(request, ctx, i18n);
	}
	return notFound(i18n, path);
}
