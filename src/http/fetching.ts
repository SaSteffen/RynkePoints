import type { Ctx } from "../ctx";
import { type FetchProgress, readFetchProgress } from "../db/strava-work";
import { createI18n, type I18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { readSession } from "./session";

// How far the rider's activities are (feature 024 US4, contracts/http-routes.md):
// the line's text, and `GET /me/fetching` for the page script's poll. One D1
// read and no Strava request (FR-020); it answers before the page dispatcher,
// so polling never renews the session, like `/me/ready`.

/** The line in the rider's language, or `null` when it doesn't show. */
export function fetchingText(
	i18n: I18n,
	progress: FetchProgress | null,
): string | null {
	if (!progress) return null;
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return progress.kind === "import"
		? i18n.t("fetching.import", { n: whole(progress.fetched) })
		: i18n.t("fetching.events", {
				done: whole(progress.done),
				total: whole(progress.total),
			});
}

/** The signed-in rider's line, read for a page (FR-021: only their own). */
export async function riderFetchingText(
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<string | null> {
	return fetchingText(i18n, await readFetchProgress(ctx.env.DB, athleteId));
}

export async function handleFetching(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	const headers = { "Cache-Control": "no-store" };
	const athleteId = await readSession(request, ctx.env, ctx.now());
	if (athleteId === null) return new Response(null, { status: 401, headers });
	const i18n = createI18n(resolveLocale(request, ctx.catalogs), ctx.catalogs);
	const text = await riderFetchingText(ctx, i18n, athleteId);
	const body = request.method === "HEAD" ? null : JSON.stringify({ text });
	return new Response(body, {
		headers: {
			...headers,
			"Content-Type": "application/json",
			"Content-Language": i18n.locale,
		},
	});
}
