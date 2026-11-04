import { hasAgreed } from "../../consent";
import type { Ctx } from "../../ctx";
import type { Rider } from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { forbidden } from "../errors";
import { html, type SafeHtml } from "../html";
import { GAUGE, PEOPLE, TREND } from "../icons";
import { isSameOrigin } from "../session";
import { type ShellViewer, shellPage } from "../shell";
import { readViewer, riderConsentState } from "../viewer";

// Who may use the admin pages (feature 025 FR-001 to FR-004, research R10). Every
// page and change reads the session, the consent and the flag afresh, so a flag
// cleared mid-session counts from the next request on. Being an organiser opens
// nothing here.

/**
 * An admin page at `path`, in the shell with Admin current: a visitor goes to `/`,
 * a rider without current consent meets the gate, and a rider who isn't an
 * administrator gets the generic 403 (FR-003).
 */
export function adminPage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	path: string,
	render: (
		viewer: ShellViewer,
	) => Promise<SafeHtml | Response> | SafeHtml | Response,
): Promise<Response> {
	return shellPage(request, ctx, i18n, "admin", path, (viewer) =>
		viewer.rider.administrator ? render(viewer) : forbidden(i18n, path),
	);
}

/**
 * The administrator sending a change: same origin, signed in, agreed to the
 * current version and flagged. Anything else is a 403 and nothing changes.
 */
export async function requireAdminPost(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	path: string,
): Promise<Rider | Response> {
	if (!isSameOrigin(request)) return forbidden(i18n, path);
	const viewer = await readViewer(request, ctx);
	if (
		viewer.kind === "visitor" ||
		!hasAgreed(riderConsentState(viewer, ctx)) ||
		!viewer.rider.administrator
	) {
		return forbidden(i18n, path);
	}
	return viewer.rider;
}

export type AdminView = "usage" | "history" | "riders";

/** The switch between the three views, like Orga's. */
export function adminSwitch(i18n: I18n, current: AdminView): SafeHtml {
	const segment = (view: AdminView, href: string, icon: SafeHtml) =>
		html`<a class="segmented" href="${href}"${view === current ? html` aria-current="true"` : null}>${icon}${i18n.t(`admin.switch.${view}`)}</a>`;
	return html`<nav class="organiser-switch" aria-label="${i18n.t("admin.switch.label")}">
${segment("usage", "/admin", GAUGE)}
${segment("history", "/admin/history", TREND)}
${segment("riders", "/admin/riders", PEOPLE)}
</nav>
`;
}

/** A moment as the team's day and time, as the tables and figures show it. */
export function moment(i18n: I18n, epochSeconds: number): string {
	const iso = new Date(epochSeconds * 1000).toISOString();
	return `${i18n.formatDate(iso)}, ${i18n.formatTime(iso)}`;
}

export function whole(i18n: I18n, n: number): string {
	return i18n.formatNumber(n, { fractionDigits: 0 });
}
