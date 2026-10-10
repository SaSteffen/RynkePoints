import { currentVersion } from "../consent";
import type { Ctx } from "../ctx";
import { recordConsent } from "../db/consents";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { consentForm, consentSummary, nextInput } from "./consent-form";
import { forbidden } from "./errors";
import { html, htmlResponse, layout, type SafeHtml } from "./html";
import { sectionNext } from "./lang";
import { redirect } from "./redirect";
import { isSameOrigin } from "./session";
import { readViewer, riderConsentState } from "./viewer";

// The consent gate (feature 004 contracts/re-consent.md, research R14): shown
// on every section instead of its content until the rider agrees to the
// current consent version. It says why, shows the current consent texts and a
// form to agree, and how to leave instead. Both forms return the rider to the
// section asked for (feature 011 research R9).

/**
 * Why the rider meets the gate: no consent record yet (US1), an older version
 * than the current one (US4), accepted on `date` as Settings shows it, or the
 * current version without a scope it requires ("Through Strava").
 */
export type GateState =
	| { state: "missing" }
	| { state: "scopes" }
	| {
			state: "older";
			accepted: number;
			date: string;
			changes: readonly MessageId[];
			viaStrava: boolean;
	  };

function intro(i18n: I18n, current: number, gate: GateState): SafeHtml | null {
	switch (gate.state) {
		case "missing":
			return html`<p>${i18n.t("me.consent.none")}</p>`;
		case "scopes":
			return null;
		case "older":
			return html`<p>${i18n.t("me.consent.renew.older", {
				accepted: String(gate.accepted),
				date: gate.date,
				version: String(current),
			})}</p>
${
	gate.changes.length === 0
		? null
		: html`<ul>
${gate.changes.map(
	(id) => html`<li>${i18n.t(id)}</li>
`,
)}</ul>`
}`;
	}
}

/** Through Strava when a permission is needed, else straight to `/me/consent`. */
function form(
	i18n: I18n,
	current: number,
	gate: GateState,
	next: string,
): SafeHtml {
	if (gate.state === "missing") return consentForm(i18n, current, next);
	if (gate.state === "scopes" || gate.viaStrava) {
		return html`<p>${i18n.t("me.consent.renew.strava")}</p>
${consentForm(i18n, current, next)}`;
	}
	return html`<form method="post" action="/me/consent">
${nextInput(next)}<p><label><input type="checkbox" name="consent" value="${current}" required> ${i18n.t("consent.agree")}</label></p>
<button class="button">${i18n.t("me.consent.renew.button")}</button>
</form>`;
}

/** The gate on the section at `path`, which the forms return to. */
export function consentGate(
	i18n: I18n,
	current: number,
	gate: GateState,
	path: string,
): Response {
	return htmlResponse(
		i18n,
		layout(i18n, {
			title: i18n.t("me.title"),
			path,
			body: html`<h1>${i18n.t("me.consent.renew.heading")}</h1>
${intro(i18n, current, gate)}
<section class="card">
<h2>${i18n.t("consent.heading")}</h2>
${consentSummary(i18n)}<p>${i18n.t("consent.required")}</p>
${form(i18n, current, gate, path)}
</section>
<p>${i18n.t("me.consent.renew.leave")}</p>
<p><a class="danger" href="/me/disconnect">${i18n.t("me.disconnect.button")}</a></p>
<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button class="button-outlined">${i18n.t("layout.logout")}</button></form>`,
		}),
	);
}

/**
 * `POST /me/consent`: the rider agrees to the current version without a trip
 * through Strava (contracts/re-consent.md). No Strava request (Principle II).
 */
export async function handleConsent(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(i18n, "/me");
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "visitor") return redirect("/", 302);
	const current = currentVersion(ctx.consentVersions).version;
	const form = await request.formData().catch(() => null);
	const next = sectionNext(form?.get("next"));
	if (form?.get("consent") !== String(current)) return redirect(next, 303);
	const state = riderConsentState(viewer, ctx);
	// The gate shows the Strava form instead; a current rider has nothing to do.
	if (state.viaStrava || state.kind === "current") return redirect(next, 303);
	await recordConsent(ctx.env.DB, viewer.rider.athleteId, current, ctx.now());
	return redirect(next, 303);
}
