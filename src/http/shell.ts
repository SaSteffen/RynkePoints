import { berlinDate } from "../config";
import { currentVersion, hasAgreed } from "../consent";
import type { Ctx } from "../ctx";
import { type Consent, getCurrentConsent } from "../db/consents";
import type { Rider } from "../db/riders";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { consentGate } from "./consent-gate";
import {
	html,
	htmlResponse,
	layout,
	type SafeHtml,
	type ShellParts,
	WORDMARK,
} from "./html";
import { BIKE, COIN, PEOPLE, REFRESH, SLIDERS } from "./icons";
import { redirect } from "./redirect";
import { readViewer, riderConsentState } from "./viewer";

// The signed-in area's four sections (feature 011 data-model.md "Section",
// research R1, R3, R8). Each is its own page; `shellPage()` applies the access
// rules of `/me` to all of them and wraps the section in the top bar and the
// navigation. The current section comes from the route, never the client.

export type SectionId = "overview" | "rides" | "team" | "settings";

/** In navigation order (FR-002). */
export const SECTIONS: readonly {
	id: SectionId;
	path: string;
	label: MessageId;
	icon: SafeHtml;
}[] = [
	{ id: "overview", path: "/me", label: "nav.overview", icon: COIN },
	{ id: "rides", path: "/me/rides", label: "nav.rides", icon: BIKE },
	{ id: "team", path: "/team", label: "nav.team", icon: PEOPLE },
	{
		id: "settings",
		path: "/me/settings",
		label: "nav.settings",
		icon: SLIDERS,
	},
];

/** The signed-in rider who agreed to the current version, and that record. */
export interface ShellViewer {
	rider: Rider;
	consent: Consent;
}

/** The team's calendar day of an acceptance, passed as UTC midnight like the season start. */
export function acceptedOn(i18n: I18n, consent: Consent): string {
	return i18n.formatDate(`${berlinDate(consent.acceptedAt)}T00:00:00Z`);
}

function shellParts(i18n: I18n, section: SectionId, path: string): ShellParts {
	const current = SECTIONS.find(({ id }) => id === section);
	const links = SECTIONS.map(
		({ id, path: href, label, icon }) =>
			html`<a href="${href}"${id === section ? html` aria-current="page"` : null}><span class="nav-icon">${icon}</span><span class="nav-label">${i18n.t(label)}</span></a>
`,
	);
	return {
		// Tapping it is a fresh GET of the same page, rides page included (R8).
		header: html`${WORDMARK}
<h1 class="section-title">${current ? i18n.t(current.label) : null}</h1>
<a class="icon-button refresh" href="${path}" aria-label="${i18n.t("shell.refresh")}">${REFRESH}</a>`,
		// After the footer, so screen readers reach the content first.
		nav: html`<nav class="app-nav" aria-label="${i18n.t("nav.label")}">
${links}</nav>
`,
	};
}

/**
 * A section at `path` (with its query): a visitor goes to `/`, a rider who
 * hasn't agreed to the current version meets the gate, which returns here
 * (FR-007, research R9); anyone else gets the section in the shell.
 */
export async function shellPage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	section: SectionId,
	path: string,
	render: (viewer: ShellViewer) => Promise<SafeHtml> | SafeHtml,
): Promise<Response> {
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "visitor") return redirect("/", 302);
	// Nothing of a section until the rider agrees (004 research R14).
	const state = riderConsentState(viewer, ctx);
	const accepted =
		viewer.consentVersion === null
			? null
			: await getCurrentConsent(ctx.env.DB, viewer.rider.athleteId);
	if (!hasAgreed(state) || !accepted) {
		const current = currentVersion(ctx.consentVersions).version;
		return consentGate(
			i18n,
			current,
			state.kind === "older" && accepted
				? {
						state: "older",
						accepted: state.accepted,
						date: acceptedOn(i18n, accepted),
						changes: state.changes,
						viaStrava: state.viaStrava,
					}
				: { state: accepted ? "scopes" : "missing" },
			path,
		);
	}
	const body = await render({ rider: viewer.rider, consent: accepted });
	// Each section names itself, so tabs and screen readers tell them apart.
	const label = SECTIONS.find(({ id }) => id === section)?.label;
	return htmlResponse(
		i18n,
		layout(i18n, {
			title:
				section === "overview" || !label
					? i18n.t("me.title")
					: i18n.t("shell.title", { section: i18n.t(label) }),
			path,
			body,
			shell: shellParts(i18n, section, path),
		}),
	);
}
