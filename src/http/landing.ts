import { clubId } from "../config";
import { currentVersion } from "../consent";
import type { Ctx } from "../ctx";
import type { I18n } from "../i18n/i18n";
import { coinPair } from "./coin";
import { consentSteps, consentSummary, step } from "./consent-form";
import { html, htmlResponse, layout, pageLook } from "./html";
import { homeOf, redirect } from "./redirect";
import { readSession } from "./session";

// The public start page: what RynkePoints reads and why, who can join, how to
// leave, who sees what, and the consent form with the Connect with Strava
// button (FR-001, FR-002, FR-022a; feature 004 FR-010, FR-011; research R21),
// under both sides of the team's coin (feature 012 FR-003). Three numbered
// steps lead there: join the team club, tick the box, connect.

/** The arrow-out-of-a-box after a link that opens Strava in a new tab. */
const OPENS_ELSEWHERE = html`<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>`;

export async function handleLanding(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const athleteId = await readSession(request, ctx.env, ctx.now());
	// A session for a deleted rider counts as signed out (research R9).
	const to = athleteId === null ? null : await homeOf(ctx, athleteId);
	if (to !== null) return redirect(to, 302);

	const title = i18n.t("landing.title");
	const clubLink = html`<a class="club-link" href="https://www.strava.com/clubs/${clubId(ctx.env)}" target="_blank" rel="noopener">${i18n.t("landing.club.button")}${OPENS_ELSEWHERE}</a>`;
	return htmlResponse(
		i18n,
		layout(i18n, {
			look: pageLook(ctx),
			title,
			path: "/",
			body: html`<div class="landing-hero">
${coinPair(ctx.team.art.coin)}
<h1>${i18n.t("app.name")}</h1>
<p class="team-name">${ctx.team.name}</p>
</div>
<p>${i18n.t("landing.intro")}</p>
<section class="club-step">
${step(1, html`<h2>${i18n.t("landing.club.heading")}</h2>`, i18n.t("landing.club.text"), clubLink)}
</section>
<section class="card">
<h2>${i18n.t("consent.heading")}</h2>
${consentSummary(i18n, "/")}${consentSteps(i18n, currentVersion(ctx.consentVersions).version)}
</section>`,
		}),
	);
}
