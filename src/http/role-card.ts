import { berlinDate } from "../config";
import { hasAgreed } from "../consent";
import type { Ctx } from "../ctx";
import {
	clearRoleCard,
	type Rider,
	roleFromCode,
	roleOf,
	setOnboarded,
} from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { hasEvents } from "../teams";
import { forbidden } from "./errors";
import { html, type SafeHtml } from "./html";
import { redirect } from "./redirect";
import { isSameOrigin } from "./session";
import { tourSwitches } from "./shell";
import { stepHref } from "./tour";
import { readViewer, riderConsentState } from "./viewer";

// The role card on the Du page (feature 043 FR-017 to FR-020, data-model.md
// "Role card"): what changed since the rider's last visit, compared with where
// the first unseen change started, so an undo leaves no card. The new
// organiser's card stands in for the Orga-Rundgang's invitation (research R6).

export type RoleCardKind = "orga" | "admin" | "notAdmin" | "none";

type CardRider = Pick<
	Rider,
	| "organiser"
	| "administrator"
	| "roleSeen"
	| "roleChangedBy"
	| "roleChangedAt"
	| "organiserOnboardedAt"
>;

/** Which card the rider gets; null for none (also when a change was undone). */
export function roleCardKind(rider: CardRider): RoleCardKind | null {
	if (rider.roleSeen === null) return null;
	const before = roleFromCode(rider.roleSeen);
	const now = roleOf(rider);
	if (before === now) return null;
	if (now === "admin") return "admin";
	if (now === "orga") return before === "admin" ? "notAdmin" : "orga";
	return "none";
}

/** Whether the card's buttons offer the Orga-Rundgang (FR-018). */
function offersTour(kind: RoleCardKind, rider: CardRider): boolean {
	return (
		(kind === "orga" || kind === "admin") && rider.organiserOnboardedAt === null
	);
}

/**
 * Whether the card stands in for the Orga-Rundgang's invitation: a change to
 * Orga or Admin the rider hasn't closed, while the tour isn't done (R6).
 */
export function cardReplacesInvitation(rider: CardRider): boolean {
	const kind = roleCardKind(rider);
	return kind !== null && offersTour(kind, rider);
}

function button(action: "close" | "tour", label: string, primary: boolean) {
	return html`<button name="action" value="${action}" class="${primary ? "button" : "button-text"}">${label}</button>`;
}

/**
 * The card for the Du page, or null. A leftover from a change and its undo is
 * cleared on a GET, without a card.
 */
export async function renderRoleCard(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	rider: Rider,
): Promise<SafeHtml | null> {
	if (rider.roleSeen === null) return null;
	const kind = roleCardKind(rider);
	if (kind === null) {
		if (request.method === "GET") {
			await clearRoleCard(ctx.env.DB, rider.athleteId);
		}
		return null;
	}
	const params = {
		by: rider.roleChangedBy ?? "",
		date:
			rider.roleChangedAt === null
				? ""
				: i18n.formatDate(`${berlinDate(rider.roleChangedAt)}T00:00:00Z`),
	};
	const tour = offersTour(kind, rider);
	const lines =
		kind === "orga"
			? html`<p>${i18n.t("role.card.orga.body", params)}</p>
<p>${i18n.t("role.card.orga.consent")}</p>`
			: kind === "none"
				? html`<p>${i18n.t("role.card.none.body", params)}${
						hasEvents(ctx.team) ? ` ${i18n.t("role.card.none.events")}` : ""
					}</p>`
				: html`<p>${i18n.t(`role.card.${kind}.body`, params)}</p>`;
	const buttons = tour
		? html`${button("tour", i18n.t(kind === "orga" ? "role.card.tour" : "role.card.orgaTour"), true)}${button("close", i18n.t("role.card.later"), false)}`
		: button("close", i18n.t("role.card.ok"), true);
	return html`<section class="notice role-notice" role="status">
<h2>${i18n.t(`role.card.${kind}.title`)}</h2>
${lines}
<form method="post" action="/me/role-card" class="actions">${buttons}</form>
</section>
`;
}

/**
 * `POST /me/role-card`: closes the card for good (FR-019). `tour` starts the
 * Orga-Rundgang; closing a card that offered it counts as skipping it, which
 * Settings still offers (R4, R6).
 */
export async function handleRoleCard(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(ctx, i18n, "/me");
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "visitor") return redirect("/", 303);
	if (!hasAgreed(riderConsentState(viewer, ctx))) return redirect("/me", 303);
	const rider = viewer.rider;
	const form = await request.formData().catch(() => new FormData());
	const kind = roleCardKind(rider);
	const tour = kind !== null && offersTour(kind, rider);
	await clearRoleCard(ctx.env.DB, rider.athleteId);
	if (tour && form.get("action") === "tour") {
		return redirect(stepHref("organiser", rider, 0, tourSwitches(ctx)), 303);
	}
	if (tour) {
		await setOnboarded(ctx.env.DB, rider.athleteId, "organiser", ctx.now());
	}
	return redirect("/me", 303);
}
