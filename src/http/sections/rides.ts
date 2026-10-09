import { readyPollSeconds } from "../../config";
import type { Ctx } from "../../ctx";
import { readRiderView } from "../../db/rider-view";
import type { I18n } from "../../i18n/i18n";
import {
	CURRENT_RULES,
	countingWindow,
	rulesForVersion,
} from "../../rynke/rules";
import { html } from "../html";
import { renderNotice, renderRides, renderWaiting } from "../rider-sections";
import { buildRiderView, parsePage } from "../rider-view";
import { shellPage } from "../shell";

// Rides at `/me/rides?page=N` (feature 011 FR-012): all the rider's rides, 20 a
// page, with what each earns and why (feature 005 US1, US4, US5), and the
// notice that says the figures are still changing; before the first data, only
// the waiting state (015 US1).

export function handleRides(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const page = parsePage(new URL(request.url));
	// The page asked for, so refreshing and the gate return to it (R8, R9).
	const path = page > 1 ? `/me/rides?page=${page}` : "/me/rides";
	return shellPage(request, ctx, i18n, "rides", path, async ({ rider }) => {
		const read = await readRiderView(ctx.env.DB, rider.athleteId, page);
		const view = buildRiderView(
			read,
			read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
			CURRENT_RULES,
			{
				...countingWindow(ctx.env),
				rulesFor: rulesForVersion,
			},
		);
		if (view.state === "waiting") {
			return renderWaiting(
				i18n,
				ctx.env.SEASON_START_DATE,
				readyPollSeconds(ctx.env),
			);
		}
		return html`${renderNotice(i18n, view)}
${renderRides(i18n, view.rides)}`;
	});
}
