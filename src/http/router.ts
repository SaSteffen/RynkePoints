import type { Ctx } from "../ctx";
import { createI18n, type I18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { handleCallback, handleConnectForm, handleReconnect } from "./auth";
import { handleConsent } from "./consent-gate";
import { notFound } from "./errors";
import { handleLanding } from "./landing";
import { handleLang } from "./lang";
import { handleDisconnect, handleDisconnectPage, handleLogout } from "./me";
import { handleNotice } from "./notice";
import { handleNotifications } from "./notifications";
import { handleSaveAttendance } from "./organiser/attendance";
import {
	handleAddCorrection,
	handleOrganiserRider,
	handleRemoveCorrection,
} from "./organiser/corrections";
import {
	handleCreateEvent,
	handleDeleteEvent,
	handleOrganiserEvent,
	handleOrganiserEvents,
	handleUpdateEvent,
} from "./organiser/events";
import { handleOrganiserOverview } from "./organiser/overview";
import {
	handleNotificationText,
	handleOffline,
	handleRiderNotificationText,
} from "./pwa";
import { handleReady } from "./ready";
import { redirect } from "./redirect";
import { handleRunDaily } from "./run-daily";
import { handleOverview } from "./sections/overview";
import { handleRides } from "./sections/rides";
import { handleSettings } from "./sections/settings";
import { handleTeam } from "./sections/team";
import { renewSession } from "./session";
import { handleWebhook } from "./webhook";

// A small path switch (research R13). `/health` and the Strava webhook answer
// in plain English; every other route is rider-facing and gets an I18n for the
// language resolved once per request. A GET or HEAD page renews the session
// (010 research R10), except the two texts the service worker caches, which
// must be the same for everyone. The signed-in app is four sections, each its
// own address: `/me`, `/me/rides`, `/team` and `/me/settings` (011 FR-001).
// Organisers manage the team under `/organiser` (feature 014).

const WEBHOOK_PREFIX = "/strava/webhook/";

/**
 * `/organiser/events/{id}`, its `/delete` and its `/attendance`; `id` is a
 * stored event's.
 */
const ORGANISER_EVENT =
	/^\/organiser\/events\/(\d{1,15})(?:\/(delete|attendance))?$/;

/** `/organiser/riders/{athleteId}` and its `/corrections`. */
const ORGANISER_RIDER = /^\/organiser\/riders\/(\d{1,15})(\/corrections)?$/;

/** `/organiser/corrections/{id}/delete`. */
const ORGANISER_CORRECTION = /^\/organiser\/corrections\/(\d{1,15})\/delete$/;

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
		// The ride list's old address, before any session read (011 FR-006, R2).
		if (path === "/me" && url.searchParams.has("page")) {
			return redirect(`/me/rides${url.search}`, 301);
		}
		if (path === "/offline") return handleOffline(request, ctx);
		if (path === "/notification-text") {
			return handleNotificationText(request, ctx);
		}
		if (path === "/me/notification-text") {
			return handleRiderNotificationText(request, ctx);
		}
		if (path === "/me/ready") return handleReady(request, ctx);
		const response = await page(request, path, ctx, i18n);
		if (response) return renewSession(request, response, ctx);
	}
	if (method === "POST") {
		switch (path) {
			case "/connect":
				return handleConnectForm(request, ctx, i18n);
			case "/lang":
				return handleLang(request, ctx, i18n);
			case "/me/consent":
				return handleConsent(request, ctx, i18n);
			case "/me/disconnect":
				return handleDisconnect(request, ctx, i18n);
			case "/me/notifications":
				return handleNotifications(request, ctx);
			case "/logout":
				return handleLogout(request, ctx, i18n);
			case "/organiser/events":
				return handleCreateEvent(request, ctx, i18n);
		}
		const event = path.match(ORGANISER_EVENT);
		if (event) {
			const eventId = Number(event[1]);
			switch (event[2]) {
				case "delete":
					return handleDeleteEvent(request, ctx, i18n, eventId);
				case "attendance":
					return handleSaveAttendance(request, ctx, i18n, eventId);
				default:
					return handleUpdateEvent(request, ctx, i18n, eventId);
			}
		}
		const rider = path.match(ORGANISER_RIDER);
		if (rider?.[2]) {
			return handleAddCorrection(request, ctx, i18n, Number(rider[1]));
		}
		const correction = path.match(ORGANISER_CORRECTION);
		if (correction) {
			return handleRemoveCorrection(request, ctx, i18n, Number(correction[1]));
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
			return handleOverview(request, ctx, i18n);
		case "/me/rides":
			return handleRides(request, ctx, i18n);
		case "/team":
			return handleTeam(request, ctx, i18n);
		case "/me/settings":
			return handleSettings(request, ctx, i18n);
		case "/me/disconnect":
			return handleDisconnectPage(request, ctx, i18n);
		case "/organiser":
			return handleOrganiserEvents(request, ctx, i18n);
		case "/organiser/riders":
			return handleOrganiserOverview(request, ctx, i18n);
	}
	const event = path.match(ORGANISER_EVENT);
	if (event && !event[2]) {
		return handleOrganiserEvent(request, ctx, i18n, Number(event[1]));
	}
	const rider = path.match(ORGANISER_RIDER);
	if (rider && !rider[2]) {
		return handleOrganiserRider(request, ctx, i18n, Number(rider[1]));
	}
	if (path.startsWith("/notice/")) {
		return handleNotice(path.slice("/notice/".length), ctx, i18n);
	}
	return null;
}
