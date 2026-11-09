import { seasonStart } from "../config";
import { secretEquals } from "../crypto/secret";
import type { Ctx } from "../ctx";
import { listConnectedRiderIds } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { sendAll } from "../work/messages";
import { notFound } from "./errors";

// Re-reads every connected rider's rides since a moment (feature 026 FR-011,
// docs/gateway-switch.md): Strava doesn't resend the events of a time without
// a subscription, such as the minute the subscription moves to the gateway.
// Only a POST with the admin bearer token runs it; anything else gets the
// unknown-address page, like /admin/run-daily. It only queues `reread-page`
// messages, which store what the list has, with the rider's Rynke.

const BEARER = /^Bearer (.+)$/;
/** How far back a catch-up may reach. */
const MAX_AGE_SECONDS = 30 * 24 * 3600;

function text(body: string, status: number): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

export async function handleCatchUp(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	path: string,
): Promise<Response> {
	const expected = ctx.env.ADMIN_TOKEN;
	const given = request.headers.get("Authorization")?.match(BEARER)?.[1];
	if (
		request.method !== "POST" ||
		!expected ||
		given === undefined ||
		!(await secretEquals(given, expected))
	) {
		return notFound(i18n, path);
	}
	const raw = new URL(request.url).searchParams.get("since") ?? "";
	const now = ctx.now();
	const since = /^\d{1,12}$/.test(raw) ? Number(raw) : Number.NaN;
	if (!(since <= now && since >= now - MAX_AGE_SECONDS)) {
		return text("since must be epoch seconds within the last 30 days", 400);
	}
	const after = Math.max(since, seasonStart(ctx.env));
	const ids = await listConnectedRiderIds(ctx.env.DB);
	await sendAll(
		ctx,
		ids.map((athleteId) => ({
			kind: "reread-page" as const,
			athleteId,
			page: 1,
			after,
		})),
	);
	return text(`queued ${ids.length}`, 202);
}
