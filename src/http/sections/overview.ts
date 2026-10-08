import type { Ctx } from "../../ctx";
import { readRiderView } from "../../db/rider-view";
import type { I18n } from "../../i18n/i18n";
import { CURRENT_RULES, rulesForVersion } from "../../rynke/rules";
import { html } from "../html";
import { renderInstallHint } from "../pwa";
import {
	renderBreakdown,
	renderGauges,
	renderNotice,
	renderRules,
	renderSummary,
} from "../rider-sections";
import { buildRiderView } from "../rider-view";
import { shellPage } from "../shell";

// The Overview at `/me` (feature 011 FR-010): what needs the rider's attention,
// the greeting, and the rider's Rynke with their gauges, where they come from
// and the rules behind them (feature 005). The rides, settings and account are
// in their own sections. A `page` query never gets here: the router sends it to
// Rides (FR-006).

export function handleOverview(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return shellPage(request, ctx, i18n, "overview", "/me", async ({ rider }) => {
		const read = await readRiderView(ctx.env.DB, rider.athleteId, 1);
		const view = buildRiderView(
			read,
			read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
			CURRENT_RULES,
			{
				seasonStart: ctx.env.SEASON_START_DATE,
				importing: rider.importStatus !== "done",
				rulesFor: rulesForVersion,
			},
		);
		const reconnect =
			rider.status === "needs_reconnect"
				? html`<aside class="notice notice-error">
<p>${i18n.t("me.status.needsReconnect")}</p>
<p><a class="button" href="/connect">${i18n.t("me.reconnect")}</a></p>
</aside>
`
				: null;
		const ready = view.state === "ready" ? view : null;
		// The install hint comes last, so it never pushes the totals down (FR-017).
		return html`${reconnect}${rider.importStatus === "done" ? html`<p>${i18n.t("me.import.done")}</p>` : null}
${renderNotice(i18n, view, ctx.env.SEASON_START_DATE)}
<p class="greeting">${i18n.t("me.greeting", { firstName: rider.firstName })}</p>
${ready ? renderSummary(i18n, ready.summary) : null}
${ready?.gauges ? renderGauges(i18n, ready.gauges) : null}
${ready ? renderBreakdown(i18n, ready.breakdown) : null}
${ready ? renderRules(i18n, ready.rules) : null}
${renderInstallHint(i18n)}`;
	});
}
