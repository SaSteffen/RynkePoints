import type { Ctx } from "../ctx";
import { createI18n, type I18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { handleCallback, handleConnectForm, handleReconnect } from "./auth";
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
import { handleNotifications } from "./notifications";
import { handleNotificationText, handleOffline } from "./pwa";
import { handleRunDaily } from "./run-daily";
import { renewSession } from "./session";
import { handleWebhook } from "./webhook";

// A small path switch (research R13). `/health` and the Strava webhook answer
// in plain English; every other route is rider-facing and gets an I18n for the
// language resolved once per request. A GET or HEAD page renews the session
// (010 research R10), except the two texts the service worker caches, which
// must be the same for everyone.

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

	if (path === "/admin/run-daily") {
		return handleRunDaily(request, ctx, i18n, path);
	}

	if (method === "GET" || method === "HEAD") {
		if (path === "/offline") return handleOffline(request, ctx);
		if (path === "/notification-text") {
			return handleNotificationText(request, ctx);
		}
		const response = await page(request, path, ctx, i18n);
		if (response) return renewSession(request, response, ctx);
	}
	if (method === "POST") {
		switch (path) {
			case "/connect":
				return handleConnectForm(request, ctx, i18n);
			case "/lang":
				return handleLang(request, ctx, i18n);
			case "/me/disconnect":
				return handleDisconnect(request, ctx, i18n);
			case "/me/notifications":
				return handleNotifications(request, ctx);
			case "/logout":
				return handleLogout(request, ctx, i18n);
		}
	}
	return notFound(i18n, path);
}

async function page(
	request: Request,
	path: string,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response | null> {
	switch (path) {
		case "/":
			return handleLanding(request, ctx, i18n);
		case "/connect":
			return handleReconnect(request, ctx);
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
	return null;
}
