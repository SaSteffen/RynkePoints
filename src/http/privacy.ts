import { contactEmail, privacyController } from "../config";
import type { Ctx } from "../ctx";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout, type SafeHtml } from "./html";

// The privacy notice (feature 017): what is processed, why, who sees it, how
// long it is kept, who processes it, and the rider's rights, with the
// controller and a contact address from the settings. Public: no session,
// no rider data. Linked from every page's footer.

/** The day the notice last changed in substance; shown on the page. */
export const PRIVACY_UPDATED = "2026-10-20";

const STRAVA_PRIVACY_URL = "https://www.strava.com/legal/privacy";

/** Each section's heading and paragraphs, in order. */
const SECTIONS: [MessageId, MessageId[]][] = [
	["privacy.purpose.heading", ["privacy.purpose.body"]],
	[
		"privacy.strava.heading",
		[
			"privacy.strava.rider",
			"privacy.strava.rides",
			"privacy.strava.runsSwims",
			"privacy.strava.private",
			"privacy.strava.never",
			"privacy.strava.how",
		],
	],
	["privacy.team.heading", ["privacy.team.body", "privacy.team.derived"]],
	[
		"privacy.technical.heading",
		[
			"privacy.technical.cookies",
			"privacy.technical.push",
			"privacy.technical.logs",
		],
	],
	[
		"privacy.visibility.heading",
		[
			"privacy.visibility.you",
			"privacy.visibility.team",
			"privacy.visibility.organisers",
			"privacy.visibility.public",
		],
	],
	["privacy.legal.heading", ["privacy.legal.body"]],
	[
		"privacy.retention.heading",
		[
			"privacy.retention.body",
			"privacy.retention.deletion",
			"privacy.retention.backups",
			"privacy.album",
		],
	],
	[
		"privacy.recipients.heading",
		[
			"privacy.recipients.cloudflare",
			"privacy.recipients.push",
			"privacy.recipients.strava",
			"privacy.recipients.usage",
		],
	],
	["privacy.links.heading", ["privacy.links.body"]],
	["privacy.rights.heading", ["privacy.rights.body"]],
	["privacy.changes.heading", ["privacy.changes.body"]],
];

export function handlePrivacy(ctx: Ctx, i18n: I18n): Response {
	const email = contactEmail(ctx.env);
	const emailLink = html`<a href="mailto:${email}">${email}</a>`;
	const stravaPrivacy = html`<a href="${STRAVA_PRIVACY_URL}">${i18n.t("privacy.recipients.stravaPrivacy")}</a>`;
	const params = { email: emailLink, stravaPrivacy };
	const paragraph = (id: MessageId): SafeHtml =>
		html`<p>${i18n.tHtml(id, params)}</p>`;
	const controller = privacyController(ctx.env).map(
		(line, i) => html`${i > 0 ? html`<br>` : ""}${line}`,
	);
	const sections = SECTIONS.map(
		([heading, paragraphs]) =>
			html`<h2>${i18n.t(heading)}</h2>\n${paragraphs.map(paragraph)}`,
	);
	const updated = i18n.formatDate(PRIVACY_UPDATED);
	const title = i18n.t("privacy.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path: "/privacy",
			body: html`<article class="privacy">
<h1>${title}</h1>
<p>${i18n.t("privacy.updated", { date: updated })}</p>
<p>${i18n.t("privacy.intro")}</p>
<h2>${i18n.t("privacy.controller.heading")}</h2>
<p>${i18n.t("privacy.controller.body")}</p>
<p class="privacy-controller">${controller}</p>
${paragraph("privacy.contact.body")}
${sections}
</article>`,
		}),
	);
}
