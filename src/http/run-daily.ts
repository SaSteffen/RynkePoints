import { secretEquals } from "../crypto/secret";
import type { Ctx } from "../ctx";
import type { I18n } from "../i18n/i18n";
import { handleScheduled } from "../work/scheduled";
import { notFound } from "./errors";

// Starts the daily cron work on demand (contracts/run-daily.md). Only a POST
// with the configured bearer token runs it, in the background; anything else
// gets the unknown-address page, so the route doesn't show (research R2, R3).

const BEARER = /^Bearer (.+)$/;

export async function handleRunDaily(
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
	ctx.waitUntil(
		handleScheduled(
			{ cron: "manual", scheduledTime: Date.now(), noRetry() {} },
			ctx,
		),
	);
	return new Response("started", {
		status: 202,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
