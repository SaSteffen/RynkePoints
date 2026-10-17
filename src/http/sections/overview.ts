import { berlinDate, readyPollSeconds } from "../../config";
import type { Ctx } from "../../ctx";
import { readRiderView } from "../../db/rider-view";
import { readSeen, type SeenRynke, writeSeen } from "../../db/rynke-seen";
import type { I18n } from "../../i18n/i18n";
import { riderStatus } from "../../rynke/pace";
import {
	CURRENT_RULES,
	countingWindow,
	rulesForVersion,
} from "../../rynke/rules";
import { amount, heroCoin, miniCoin } from "../coin";
import { html, type SafeHtml } from "../html";
import {
	renderBreakdown,
	renderGauges,
	renderNotice,
	renderReconnect,
	renderSummary,
	renderWaiting,
} from "../rider-sections";
import { buildRiderView } from "../rider-view";
import { shellPage } from "../shell";

// The Overview at `/me`, labelled "You" (feature 011 FR-010, issue #73): the greeting first, then what
// needs the rider's attention (015 FR-008, FR-009), and the rider's Rynke
// with their gauges and where they come from (feature 005). The rides, the
// badges, the settings with the rules (issue #92) and the account are in their
// own sections. A `page`
// query never gets here: the router sends it to Rides (FR-006). The greeting
// sits in the coin hero; a celebration of the Rynke that are new since the
// rider last opened the Overview follows the notices (feature 012 US1, US2).

/** New Rynke since `seen`, or nothing to celebrate. */
function renderCelebration(
	i18n: I18n,
	seen: SeenRynke | null,
	now: SeenRynke,
): SafeHtml | null {
	if (!seen) return null;
	const training = Math.max(now.training - seen.training, 0);
	const team = Math.max(now.team - seen.team, 0);
	if (training === 0 && team === 0) return null;
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const text =
		training > 0 && team > 0
			? i18n.t("celebrate.both", {
					training: whole(training),
					team: whole(team),
				})
			: training > 0
				? i18n.t("celebrate.training", { n: whole(training) })
				: i18n.t("celebrate.team", { n: whole(team) });
	// Two coins drop in: one of each kind that rose, or two of the one.
	const coins =
		training > 0 && team > 0
			? [miniCoin("training"), miniCoin("team")]
			: [
					miniCoin(training > 0 ? "training" : "team"),
					miniCoin(training > 0 ? "training" : "team"),
				];
	return html`<aside class="celebrate" role="status">
<span class="celebrate-coins" aria-hidden="true">${coins}</span>
<p>${text}</p>
</aside>
`;
}

export function handleOverview(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return shellPage(request, ctx, i18n, "you", "/me", async ({ rider }) => {
		const read = await readRiderView(ctx.env.DB, rider.athleteId, 1);
		const window = countingWindow(ctx.env);
		const view = buildRiderView(
			read,
			read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
			CURRENT_RULES,
			{ ...window, rulesFor: rulesForVersion },
		);
		// The same rule as the Team quote and the organiser groups (016 FR-030).
		const status = riderStatus(
			read.balance,
			CURRENT_RULES,
			window,
			berlinDate(ctx.now()),
		);
		const ready = view.state === "ready" ? view : null;
		const totals = ready && {
			training: ready.summary.training.value,
			team: ready.summary.team.value,
		};
		// Only a GET marks the Rynke as seen, so a HEAD can't eat the celebration.
		const seen = totals && (await readSeen(ctx.env.DB, rider.athleteId));
		if (
			totals &&
			request.method === "GET" &&
			(seen?.training !== totals.training || seen?.team !== totals.team)
		) {
			await writeSeen(ctx.env.DB, rider.athleteId, totals);
		}
		// One grid holds it all: two columns on wider screens (contracts/pages.md).
		return html`<div class="overview-grid">
<section class="hero">
${heroCoin()}
<div>
<p class="greeting">${i18n.t("me.greeting", { firstName: rider.firstName })}</p>
${
	totals
		? html`<p class="hero-total">${i18n.tHtml("hero.training", { n: amount(i18n, totals.training) })}</p>
<p class="hero-total hero-team">${i18n.tHtml("hero.team", { n: amount(i18n, totals.team) })}</p>
`
		: null
}</div>
</section>
${renderReconnect(i18n, rider)}${renderNotice(i18n, view)}
${ready ? null : renderWaiting(i18n, ctx.env.SEASON_START_DATE, readyPollSeconds(ctx.env))}
${totals ? renderCelebration(i18n, seen, totals) : null}${ready ? renderSummary(i18n, ready.summary, status) : null}
${ready?.gauges ? renderGauges(i18n, ready.gauges) : null}
${ready ? renderBreakdown(i18n, ready.breakdown) : null}
</div>`;
	});
}
