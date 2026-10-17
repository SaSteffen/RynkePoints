import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	type ListedRider,
	type ListedRiderRow,
	listListedRidersStatement,
	withProfileLinks,
} from "../../db/organiser";
import {
	deleteReportsStatement,
	listEventReportsStatement,
} from "../../db/participation";
import {
	listEventAttendeesStatement,
	readTeamEventStatement,
	type TeamEventRecordRow,
} from "../../db/team-events";
import type { I18n } from "../../i18n/i18n";
import { TeamEventRefused, teamEventChange } from "../../rynke/apply";
import { hasTakenPlace } from "../../rynke/participation";
import { html, type SafeHtml } from "../html";
import { redirect } from "../redirect";
import { noticeFromQuery, redirectWith, requireOrganiserPost } from "./access";

// Who attended an event (feature 014 Story 2, research R6): one checklist of
// the listed riders on the event page. Each checkbox carries the state the page
// showed, so a save applies only this organiser's ticks and unticks and leaves
// a rider another organiser ticked meanwhile alone. Riders who aren't listed
// are never touched. Attendance is recorded once the event has taken place
// (FR-022).

const LIST = "/organiser";

const eventPath = (id: number) => `/organiser/events/${id}`;

/**
 * The listed riders, the event's attendees and the riders who reported it
 * without attendance (019 FR-040), for `attendanceSection`.
 */
export async function readAttendance(
	ctx: Ctx,
	eventId: number,
): Promise<{
	riders: ListedRider[];
	attendees: Set<number>;
	reports: Set<number>;
}> {
	const [riderRows, attendeeRows, reportRows] = await ctx.env.DB.batch([
		listListedRidersStatement(ctx.env.DB),
		listEventAttendeesStatement(ctx.env.DB, eventId),
		listEventReportsStatement(ctx.env.DB, eventId),
	]);
	const ids = (rows: { results?: unknown[] } | undefined) =>
		new Set(
			((rows?.results ?? []) as { athlete_id: number }[]).map(
				(r) => r.athlete_id,
			),
		);
	return {
		riders: withProfileLinks((riderRows?.results ?? []) as ListedRiderRow[]),
		attendees: ids(attendeeRows),
		reports: ids(reportRows),
	};
}

/** Whether `date` is after today in Berlin (FR-022, 019 research R2). */
export function isFutureEvent(ctx: Ctx, date: string): boolean {
	return !hasTakenPlace(date, berlinDate(ctx.now()));
}

function riderItem(
	i18n: I18n,
	rider: ListedRider,
	attended: boolean,
	form: boolean,
	reported = false,
): SafeHtml {
	const link =
		rider.profileLink === null
			? ""
			: html` <a href="${rider.profileLink}">${i18n.t("organiser.attendance.profile")}</a>`;
	if (!form) {
		// An upcoming event: an intent shows as a locked grey box (019 FR-043).
		const intent = reported
			? html`<span class="tri-box tri-requested" aria-hidden="true"></span>`
			: null;
		const tag = reported
			? html`<span class="tri-tag">${i18n.t("organiser.attendance.tag.intent")}</span>`
			: null;
		return html`<li class="attendance-rider${reported ? " attendance-requested" : ""}">${intent}<span class="rider-name">${rider.first_name}</span>${tag}${link}</li>`;
	}
	if (reported) return requestItem(i18n, rider, link);
	const id = rider.athlete_id;
	return html`<li class="attendance-rider"><label><input type="checkbox" name="attend" value="${id}"${attended ? html` checked` : ""}><span class="rider-name">${rider.first_name}</span></label><input type="hidden" name="shown" value="${id}:${attended ? 1 : 0}">${link}</li>`;
}

/**
 * A rider with an open request: three radios, open checked, which
 * `public/app.js` turns into one tri-state box (019 research R5). The tags say
 * what saving will do; the script shows the one that fits.
 */
function requestItem(
	i18n: I18n,
	rider: ListedRider,
	link: SafeHtml | string,
): SafeHtml {
	const id = rider.athlete_id;
	const radio = (value: "open" | "yes" | "no") =>
		html`<label><input type="radio" name="decide-${id}" value="${value}"${value === "open" ? html` checked` : null}><span>${i18n.t(`organiser.attendance.decide.${value}`)}</span></label>`;
	const tag = (value: "open" | "yes" | "no") =>
		html`<span class="tri-tag tri-tag-${value}"${value === "open" ? null : html` hidden`}>${i18n.t(`organiser.attendance.tag.${value}`)}</span>`;
	return html`<li class="attendance-rider attendance-requested"><fieldset class="tri-state"><legend><span class="rider-name">${rider.first_name}</span></legend>${radio("open")}${radio("yes")}${radio("no")}</fieldset>${tag("open")}${tag("yes")}${tag("no")}<input type="hidden" name="shown" value="${id}:r">${link}</li>`;
}

/** The summary's placeholders, kept for `public/app.js` to fill. */
const SUMMARY_SLOTS = { yes: "{yes}", no: "{no}", open: "{open}" };

/** The three example boxes above the list (019 FR-040). */
function legend(i18n: I18n, future: boolean): SafeHtml {
	const item = (box: string, label: SafeHtml | string) =>
		html`<li><span class="tri-box ${box}" aria-hidden="true"></span><span>${label}</span></li>`;
	return html`<ul class="tri-legend" aria-label="${i18n.t("organiser.attendance.legend")}">${item("tri-empty", i18n.t("organiser.attendance.legend.empty"))}${item("tri-requested", i18n.t(future ? "organiser.attendance.legend.greyFuture" : "organiser.attendance.legend.grey"))}${item("tri-checked", i18n.t("organiser.attendance.legend.checked"))}</ul>
`;
}

/**
 * The event page's checklist: one form with a checkbox per listed rider, or
 * for an event still to come only the list and a note (FR-020, FR-022).
 * Riders who reported the event come first, as grey boxes (019 FR-040–FR-043).
 */
export function attendanceSection(
	i18n: I18n,
	event: { eventId: number; future: boolean },
	riders: ListedRider[],
	attendees: Set<number>,
	reports: ReadonlySet<number> = new Set(),
): SafeHtml {
	const { future } = event;
	const reported = (r: ListedRider) =>
		reports.has(r.athlete_id) && !attendees.has(r.athlete_id);
	const count = future
		? i18n.t("organiser.attendance.countFuture", {
				count: String(riders.filter(reported).length),
			})
		: i18n.t("organiser.attendance.count", { count: String(attendees.size) });
	const heading = html`<div class="attendance-head"><h2>${i18n.t(future ? "organiser.attendance.headingFuture" : "organiser.attendance.heading")}</h2><span>${count}</span></div>`;
	if (riders.length === 0) {
		return html`${heading}
<p>${i18n.t("organiser.attendance.none")}</p>`;
	}
	const ordered = [
		...riders.filter(reported),
		...riders.filter((r) => !reported(r)),
	];
	const open = ordered.filter(reported).length;
	const items = (form: boolean) =>
		html`<ul class="attendance-list">${ordered.map((r) =>
			riderItem(i18n, r, attendees.has(r.athlete_id), form, reported(r)),
		)}</ul>`;
	if (future) {
		return html`${heading}
${legend(i18n, true)}<p>${i18n.t("organiser.attendance.future")}</p>
${items(false)}`;
	}
	const hint =
		open > 0
			? html`<p class="team-hint">${i18n.t("organiser.attendance.greyHint")}</p>`
			: null;
	// Shown by the script, which is what makes it work (research R5).
	const all =
		open > 1
			? html`<button type="button" class="button-outlined confirm-all" hidden>${i18n.t("organiser.attendance.confirmAll", { n: String(open) })}</button>`
			: null;
	const summary =
		open > 0
			? html`<p class="tri-summary" role="status" hidden data-text="${i18n.t("organiser.attendance.summary", SUMMARY_SLOTS)}"></p>`
			: null;
	return html`${heading}
${legend(i18n, false)}${hint}
<form method="post" action="${eventPath(event.eventId)}/attendance" class="attendance-form">
${all}${items(true)}
<button class="button">${i18n.t("organiser.attendance.save")}</button>
${summary}</form>`;
}

/** What the form asks for: 014's ticks and 019's decisions on requests. */
interface AttendanceDiff {
	add: number[];
	remove: number[];
	/** Requests to confirm (019 FR-042). */
	confirm: number[];
	/** Requests to deny. */
	deny: number[];
	/** Requests left grey. */
	open: number;
}

/**
 * The ticks and unticks of the form: `add` ticked but shown unticked,
 * `remove` shown ticked but unticked; for riders shown with a request
 * (`id:r`), their `decide-{id}`. Null when an id isn't listed or a `shown`
 * value is malformed.
 */
function attendanceDiff(
	form: FormData,
	listed: Set<number>,
): AttendanceDiff | null {
	const attend = new Set<number>();
	for (const value of form.getAll("attend")) {
		const id = Number(value);
		if (!listed.has(id)) return null;
		attend.add(id);
	}
	const shown = new Map<number, boolean>();
	const requested: number[] = [];
	for (const value of form.getAll("shown")) {
		const match = typeof value === "string" && value.match(/^(\d+):([01r])$/);
		if (!match || !listed.has(Number(match[1]))) return null;
		if (match[2] === "r") requested.push(Number(match[1]));
		else shown.set(Number(match[1]), match[2] === "1");
	}
	const decide = (id: number) => form.get(`decide-${id}`);
	const confirm = requested.filter((id) => decide(id) === "yes");
	const deny = requested.filter((id) => decide(id) === "no");
	return {
		add: [...attend].filter((id) => shown.get(id) !== true),
		remove: [...shown]
			.filter(([id, ticked]) => ticked && !attend.has(id))
			.map(([id]) => id),
		confirm,
		deny,
		open: requested.length - confirm.length - deny.length,
	};
}

/** `POST /organiser/events/{id}/attendance`: the organiser's ticks (FR-021). */
export async function handleSaveAttendance(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	const path = eventPath(eventId);
	const rider = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		`${path}/attendance`,
	);
	if (rider instanceof Response) return rider;
	const form = await request.formData();
	const [eventRows, riderRows, reportRows] = await ctx.env.DB.batch([
		readTeamEventStatement(ctx.env.DB, eventId),
		listListedRidersStatement(ctx.env.DB),
		listEventReportsStatement(ctx.env.DB, eventId),
	]);
	const event = (eventRows?.results as TeamEventRecordRow[] | undefined)?.[0];
	if (!event) return redirectWith(LIST, "error", "event_missing");
	if (isFutureEvent(ctx, event.event_date)) {
		return redirectWith(path, "error", "future_event");
	}
	const listed = new Set(
		((riderRows?.results ?? []) as ListedRiderRow[]).map((r) => r.athlete_id),
	);
	const diff = attendanceDiff(form, listed);
	if (!diff) return redirectWith(path, "error", "rider_not_listed");
	// A request another organiser settled meanwhile stays as it is.
	const open = new Set(
		((reportRows?.results ?? []) as { athlete_id: number }[]).map(
			(r) => r.athlete_id,
		),
	);
	const confirm = diff.confirm.filter((id) => open.has(id));
	const deny = diff.deny.filter((id) => open.has(id));
	const add = [...new Set([...diff.add, ...confirm])];
	try {
		if (add.length > 0) {
			await teamEventChange(ctx, {
				kind: "add-attendance",
				eventId,
				athleteIds: add,
				by: rider.athleteId,
			});
		}
		if (deny.length > 0) {
			await deleteReportsStatement(ctx.env.DB, eventId, deny).run();
		}
		if (diff.remove.length > 0) {
			await teamEventChange(ctx, {
				kind: "remove-attendance",
				eventId,
				athleteIds: diff.remove,
			});
		}
		if (confirm.length + deny.length + diff.open > 0) {
			return redirect(
				`${path}?done=attendance&yes=${confirm.length}&no=${deny.length}&open=${diff.open}`,
				303,
			);
		}
		return redirectWith(path, "done", "attendance");
	} catch (error) {
		if (error instanceof TeamEventRefused) {
			return error.code === "event_missing"
				? redirectWith(LIST, "error", error.code)
				: redirectWith(path, "error", error.code);
		}
		throw error;
	}
}

/**
 * The notice after saving with requests on the page, which counts them
 * (019 FR-042); else 014's notice.
 */
export function attendanceNotice(url: URL, i18n: I18n): SafeHtml | null {
	const q = url.searchParams;
	const counts = ["yes", "no", "open"].map((key) => q.get(key) ?? "");
	if (
		q.get("done") === "attendance" &&
		counts.every((n) => /^\d{1,4}$/.test(n))
	) {
		const [yes = "0", no = "0", open = "0"] = counts;
		return html`<p class="notice" role="status">${i18n.t("organiser.done.attendance.reports", { yes, no, open })}</p>
`;
	}
	return noticeFromQuery(url, i18n);
}
