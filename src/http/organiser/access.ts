import { berlinDate } from "../../config";
import { hasAgreed } from "../../consent";
import type { Ctx } from "../../ctx";
import type { Rider } from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { forbidden } from "../errors";
import { html, type SafeHtml } from "../html";
import { CALENDAR, PEOPLE } from "../icons";
import { redirect } from "../redirect";
import { isSameOrigin } from "../session";
import { type ShellViewer, shellPage } from "../shell";
import { readViewer, riderConsentState } from "../viewer";

// Who may use the organiser pages, and what they share (feature 014 research
// R1, R3, R9). Every page and every change reads the session, the consent and
// the organiser flag afresh (004 FR-003), so a flag cleared mid-session counts
// from the next request on.

/** The `?done=` codes of contracts/http-routes.md. */
const DONE_CODES = [
	"created",
	"saved",
	"deleted",
	"attendance",
	"added",
	"removed",
] as const;

/** The `?error=` codes of contracts/http-routes.md. */
const ERROR_CODES = [
	"unknown_kind",
	"invalid_date",
	"invalid_name",
	"event_missing",
	"rider_not_connected",
	"outside_season",
	"future_event",
	"rider_not_listed",
	"invalid_amount",
	"invalid_reason",
	"correction_missing",
] as const;

export type DoneCode = (typeof DONE_CODES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * An organiser page at `path`, in the shell with Orga current: a visitor goes
 * to `/` and a rider without current consent meets the gate, as on every
 * section; a rider who isn't an organiser gets 403 (FR-001).
 */
export function organiserPage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	path: string,
	render: (
		viewer: ShellViewer,
	) => Promise<SafeHtml | Response> | SafeHtml | Response,
): Promise<Response> {
	return shellPage(request, ctx, i18n, "organiser", path, (viewer) =>
		viewer.rider.organiser ? render(viewer) : forbidden(i18n, path),
	);
}

/**
 * The organiser sending a change: same origin, signed in, agreed to the
 * current consent version and flagged. Anything else is a 403 and nothing
 * changes (FR-001, SC-002).
 */
export async function requireOrganiserPost(
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
		!viewer.rider.organiser
	) {
		return forbidden(i18n, path);
	}
	return viewer.rider;
}

/**
 * The switch between Orga's two views, the team overview and the events, like
 * the Team page's Training and Team (feature 016).
 */
export function organiserSwitch(
	i18n: I18n,
	current: "riders" | "events",
): SafeHtml {
	const segment = (view: "riders" | "events", href: string, icon: SafeHtml) =>
		html`<a class="segmented" href="${href}"${view === current ? html` aria-current="true"` : null}>${icon}${i18n.t(`organiser.switch.${view}`)}</a>`;
	return html`<nav class="organiser-switch" aria-label="${i18n.t("organiser.switch.label")}">
${segment("riders", "/organiser/riders", PEOPLE)}
${segment("events", "/organiser", CALENDAR)}
</nav>
`;
}

/** The confirmation or refusal named in the query, for known codes only. */
export function noticeFromQuery(url: URL, i18n: I18n): SafeHtml | null {
	const done = url.searchParams.get("done");
	if ((DONE_CODES as readonly (string | null)[]).includes(done)) {
		return html`<p class="notice" role="status">${i18n.t(`organiser.done.${done as DoneCode}`)}</p>
`;
	}
	const error = url.searchParams.get("error");
	if ((ERROR_CODES as readonly (string | null)[]).includes(error)) {
		return html`<p class="notice notice-error" role="alert">${i18n.t(`organiser.error.${error as ErrorCode}`)}</p>
`;
	}
	return null;
}

/**
 * Who changed an input and when (FR-040, R9): nothing for an input from
 * before feature 014; "former organiser" when the organiser has gone or no
 * longer shares their name (`firstName` null); else their first name.
 */
export function changeRecord(
	i18n: I18n,
	firstName: string | null,
	changedAt: number | null,
): SafeHtml | null {
	if (changedAt === null) return null;
	return html`<p class="change-record">${i18n.t("organiser.changedBy", {
		name: firstName ?? i18n.t("organiser.formerOrganiser"),
		date: i18n.formatDate(`${berlinDate(changedAt)}T00:00:00Z`),
	})}</p>
`;
}

/** `303` to `path` with `?done=` or `?error=` (R3). */
export function redirectWith(
	path: string,
	param: "done" | "error",
	code: DoneCode | ErrorCode,
): Response {
	return redirect(`${path}?${param}=${encodeURIComponent(code)}`, 303);
}
