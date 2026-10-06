import type { Ctx } from "../ctx";
import { createI18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import {
	handleCallback,
	handleConnectForm,
	handleReconnect,
	handleSignIn,
} from "./auth";
import { notFound } from "./errors";
import { handleLanding } from "./landing";
import { handleLang } from "./lang";
import {
	handleDisconnect,
	handleDisconnectPage,
	handleLogout,
	handleMe,
} from "./me";
import { handleNotice } from "./notice";
import { handleWebhook } from "./webhook";

// A small path switch (research R13). `/health` and the Strava webhook answer
// in plain English; every other route is rider-facing and gets an I18n for the
// language resolved once per request.

const WEBHOOK_PREFIX = "/strava/webhook/";

export async function route(request: Request, ctx: Ctx): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;

	if (path === "/health") return new Response("ok");
	if (path.startsWith(WEBHOOK_PREFIX)) {
		return handleWebhook(request, path.slice(WEBHOOK_PREFIX.length), ctx);
	}

	const i18n = createI18n(resolveLocale(request, ctx.catalogs), ctx.catalogs);

	if (method === "GET" || method === "HEAD") {
		switch (path) {
			case "/":
				return handleLanding(request, ctx, i18n);
			case "/connect":
				return handleReconnect(request, ctx);
			case "/signin":
				return handleSignIn(request, ctx);
			case "/auth/callback":
				return handleCallback(request, ctx);
			case "/me":
				return handleMe(request, ctx, i18n);
			case "/me/disconnect":
				return handleDisconnectPage(request, ctx, i18n);
		}
		if (path.startsWith("/notice/")) {
			return handleNotice(path.slice("/notice/".length), ctx, i18n);
		}
	}
	if (method === "POST") {
		switch (path) {
			case "/connect":
				return handleConnectForm(request, ctx, i18n);
			case "/lang":
				return handleLang(request, ctx, i18n);
			case "/me/disconnect":
				return handleDisconnect(request, ctx, i18n);
			case "/logout":
				return handleLogout(request, i18n);
		}
	}
	return notFound(i18n, path);
}
