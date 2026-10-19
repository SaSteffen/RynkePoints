import { berlinDate, readyPollSeconds } from "../../config";
import { hasAgreed } from "../../consent";
import type { Ctx } from "../../ctx";
import { hasBalance, readRideBatch, readRiderView } from "../../db/rider-view";
import type { I18n } from "../../i18n/i18n";
import {
	CURRENT_RULES,
	countingWindow,
	rulesForVersion,
} from "../../rynke/rules";
import { html, htmlResponse } from "../html";
import {
	renderExampleNote,
	renderNotice,
	renderRideBatch,
	renderRides,
	renderWaiting,
} from "../rider-sections";
import {
	buildRiderView,
	parseBatchLimit,
	parsePage,
	parseRideKey,
	rideLines,
} from "../rider-view";
import { shellPage } from "../shell";
import {
	EXAMPLE_REJECTED_RIDE_ID,
	EXAMPLE_SHORT_RIDE_ID,
	exampleRiderView,
} from "../tour-example";
import { readViewer, riderConsentState } from "../viewer";

// Rides at `/me/rides?page=N` (feature 011 FR-012): all the rider's rides, 20 a
// page, with what each earns and why (feature 005 US1, US4, US5), and the
// notice that says the figures are still changing; before the first data, only
// the waiting state (015 US1). The page script turns the pages into one list
// fed by `/me/rides/more` (feature 018).

export function handleRides(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const page = parsePage(new URL(request.url));
	// The page asked for, so refreshing and the gate return to it (R8, R9).
	const path = page > 1 ? `/me/rides?page=${page}` : "/me/rides";
	return shellPage(
		request,
		ctx,
		i18n,
		"rides",
		path,
		async ({ rider, example }) => {
			const window = countingWindow(ctx.env);
			// On the rider tour's steps, the example rider's rides instead
			// (feature 020 FR-005); none of them links to Strava (FR-007).
			const read = example
				? exampleRiderView(window, berlinDate(ctx.now()))
				: await readRiderView(ctx.env.DB, rider.athleteId, page);
			const view = buildRiderView(
				read,
				read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
				CURRENT_RULES,
				{ ...window, rulesFor: rulesForVersion },
			);
			if (view.state === "waiting") {
				return renderWaiting(
					i18n,
					ctx.env.SEASON_START_DATE,
					readyPollSeconds(ctx.env),
				);
			}
			if (example) {
				return html`${renderExampleNote(i18n)}${renderRides(i18n, view.rides, {
					rejectedRideId: EXAMPLE_REJECTED_RIDE_ID,
					shortRideId: EXAMPLE_SHORT_RIDE_ID,
				})}`;
			}
			return html`${renderNotice(i18n, view)}
${renderRides(i18n, view.rides)}`;
		},
	);
}

/**
 * The next rides of the continuous list, `GET /me/rides/more?after=<key>`
 * (feature 018 contracts/http-routes.md): `shellPage`'s access rules without
 * the shell, answered with a status the page script acts on (research R3).
 */
export async function handleMoreRides(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const headers = { "Cache-Control": "no-store" };
	const refuse = (status: number) => new Response(null, { status, headers });
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "visitor") return refuse(401);
	const accepted = viewer.consent;
	if (!hasAgreed(riderConsentState(viewer, ctx)) || !accepted) {
		return refuse(403);
	}
	const url = new URL(request.url);
	const afters = url.searchParams.getAll("after");
	const after = afters.length === 1 ? parseRideKey(afters[0] ?? null) : null;
	const limit = parseBatchLimit(url);
	if (!after || limit === null) return refuse(400);
	const athleteId = viewer.rider.athleteId;
	if (!(await hasBalance(ctx.env.DB, athleteId))) return refuse(409);
	const batch = await readRideBatch(ctx.env.DB, athleteId, after, limit);
	const rows = rideLines(batch.rides, {
		...countingWindow(ctx.env),
		rulesFor: rulesForVersion,
	});
	return htmlResponse(
		i18n,
		renderRideBatch(i18n, rows, batch.more),
		200,
		headers,
	);
}
