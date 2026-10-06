import type { Ctx } from "../ctx";
import { getRider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout } from "./html";
import { redirect } from "./redirect";
import { readSession } from "./session";

// The rider's own page (contracts/http-routes.md, GET /me): connection status,
// granted level and import progress. Recent rides follow with US4.

export async function handleMe(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const athleteId = await readSession(request, ctx.env, ctx.now());
	const rider =
		athleteId === null ? null : await getRider(ctx.env.DB, athleteId);
	if (!rider) return redirect("/", 302);

	const title = i18n.t("me.title");
	const status =
		rider.status === "connected"
			? html`<p>${i18n.t("me.status.connected")}</p>`
			: html`<p>${i18n.t("me.status.needsReconnect")}</p>
<p><a href="/connect">${i18n.t("me.reconnect")}</a></p>`;
	// The configured date, not the Berlin-midnight epoch: that is the day before
	// in UTC.
	const seasonStart = i18n.formatDate(`${ctx.env.SEASON_START_DATE}T00:00:00Z`);
	const importStatus =
		rider.importStatus === "done"
			? i18n.t("me.import.done")
			: i18n.t("me.import.running", { date: seasonStart });

	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path: "/me",
			body: html`<h1>${i18n.t("me.greeting", { firstName: rider.firstName })}</h1>
${status}
<p>${i18n.t(rider.scopeReadAll ? "me.scope.readAll" : "me.scope.sharedOnly")}</p>
<p>${importStatus}</p>
<section>
<h2>${i18n.t("me.recent.heading")}</h2>
</section>
<form method="post" action="/logout"><button>${i18n.t("layout.logout")}</button></form>`,
		}),
	);
}
