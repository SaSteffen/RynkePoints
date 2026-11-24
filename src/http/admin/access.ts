import { hasAgreed } from "../../consent";
import type { Ctx } from "../../ctx";
import type { Rider } from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import type { AllowanceId } from "../../usage/allowances";
import { markCount } from "../../usage/attention";
import { forbidden } from "../errors";
import { html, type SafeHtml } from "../html";
import { GAUGE, PEOPLE } from "../icons";
import { isSameOrigin } from "../session";
import { countBadge, type ShellViewer, shellPage } from "../shell";
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
		viewer.rider.administrator ? render(viewer) : forbidden(ctx, i18n, path),
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
	if (!isSameOrigin(request)) return forbidden(ctx, i18n, path);
	const viewer = await readViewer(request, ctx);
	if (
		viewer.kind === "visitor" ||
		!hasAgreed(riderConsentState(viewer, ctx)) ||
		!viewer.rider.administrator
	) {
		return forbidden(ctx, i18n, path);
	}
	return viewer.rider;
}

export type AdminView = "usage" | "riders";

/** The usage marks the Admin tab counts, from the state the shell read once. */
export async function usageMarks(viewer: ShellViewer): Promise<number> {
	return viewer.usage ? markCount((await viewer.usage).items).total : 0;
}

/**
 * The switch between the views, like Orga's; "Nutzung" carries the Admin
 * tab's number of usage marks (feature 048 contracts/nav-count.md).
 */
export function adminSwitch(
	i18n: I18n,
	current: AdminView,
	marks: number,
): SafeHtml {
	const counted = (view: AdminView) => view === "usage" && marks > 0;
	const segment = (view: AdminView, href: string, icon: SafeHtml) =>
		html`<a class="segmented" href="${href}"${counted(view) ? html` aria-label="${i18n.t("admin.switch.usage.marks", { n: marks })}"` : null}${view === current ? html` aria-current="true"` : null}>${icon}${i18n.t(`admin.switch.${view}`)}${counted(view) ? countBadge(marks) : null}</a>`;
	return html`<nav class="organiser-switch" aria-label="${i18n.t("admin.switch.label")}">
${segment("riders", "/admin/riders", PEOPLE)}
${segment("usage", "/admin", GAUGE)}
</nav>
`;
}

/** A moment as its UTC day and time, as the tables and figures show it. */
export function moment(i18n: I18n, epochSeconds: number): string {
	const iso = new Date(epochSeconds * 1000).toISOString();
	return `${i18n.formatDate(iso)}, ${i18n.formatTime(iso)}`;
}

export function whole(i18n: I18n, n: number): string {
	return i18n.formatNumber(n, { fractionDigits: 0 });
}

const BYTES_PER_GB = 1_000_000_000;

/** An amount in the allowance's unit: storage in GB, the rest as counted. */
export function amount(i18n: I18n, id: AllowanceId, value: number): string {
	return id === "cf_d1_storage_bytes"
		? i18n.t("admin.gigabytes", {
				n: i18n.formatNumber(value / BYTES_PER_GB, { fractionDigits: 2 }),
			})
		: whole(i18n, value);
}
