import { berlinDate } from "../../config";
import { signValue, verifySignedValue } from "../../crypto/sign";
import type { Ctx } from "../../ctx";
import { type ListedRiderRow, withProfileLinks } from "../../db/organiser";
import {
	deleteReportsStatement,
	insertReportStatement,
	listEventReportsStatement,
	type OpenRequestRow,
} from "../../db/participation";
import {
	readTeamEventStatement,
	type TeamEventRecordRow,
} from "../../db/team-events";
import type { I18n } from "../../i18n/i18n";
import { TeamEventRefused, teamEventChange } from "../../rynke/apply";
import { hasTakenPlace } from "../../rynke/participation";
import { html, type SafeHtml } from "../html";
import { CHECK, CLOSE } from "../icons";
import { redirect } from "../redirect";
import { requireOrganiserPost } from "./access";

// Organisers settle riders' requests in one tap (feature 019 US4, FR-030–
// FR-035, research R4): the open requests grouped by event on Termine, one
// line per request in the overview, and an undo for the last decision.
// Confirming records attendance like any other (FR-035), which deletes the
// report (research R3); denying deletes it and keeps nothing (FR-023).

/** Where a decision may send the organiser back to (contracts/http-routes.md). */
const BACK =
	/^\/organiser(?:\/riders(?:\?group=(?:push|on_track|in|requests|all))?)?$/;

const UNDO_CONTEXT = "request-undo";
/** How long "Rückgängig" works, in seconds. */
const UNDO_SECONDS = 600;

export type Decision = "confirm" | "deny";

/** What an undo puts back: the decision, the event and each report's time. */
export interface UndoValue {
	decision: Decision;
	eventId: number;
	reports: { athleteId: number; reportedAt: number }[];
}

/** `back`, or `/organiser` when it isn't one of the allowed pages. */
export function safeBack(value: unknown): string {
	return typeof value === "string" && BACK.test(value) ? value : "/organiser";
}

function withQuery(path: string, query: string): string {
	return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/** The signed token of an undo (data-model.md "Undo token"). */
export function undoToken(
	value: UndoValue,
	now: number,
	key: string,
): Promise<string> {
	const ids = value.reports.map((r) => r.athleteId).join("_");
	const times = value.reports.map((r) => r.reportedAt).join("_");
	return signValue(
		`${value.decision}-${value.eventId}-${ids}-${times}`,
		now + UNDO_SECONDS,
		key,
		UNDO_CONTEXT,
	);
}

/** The token's value if it is valid and not expired, else null. */
export async function readUndoToken(
	token: string,
	now: number,
	key: string,
): Promise<UndoValue | null> {
	const verified = await verifySignedValue(token, key, now, UNDO_CONTEXT);
	if (!verified) return null;
	const match = verified.value.match(
		/^(confirm|deny)-(\d+)-(\d+(?:_\d+)*)-(\d+(?:_\d+)*)$/,
	);
	if (!match) return null;
	const ids = (match[3] ?? "").split("_").map(Number);
	const times = (match[4] ?? "").split("_").map(Number);
	if (ids.length !== times.length) return null;
	return {
		decision: match[1] as Decision,
		eventId: Number(match[2]),
		reports: ids.map((athleteId, i) => ({
			athleteId,
			reportedAt: times[i] ?? 0,
		})),
	};
}

/** The event's kind and date, as the requests name it. */
export function eventLabel(
	i18n: I18n,
	event: { kind: OpenRequestRow["kind"]; event_date: string },
): string {
	return `${i18n.t(`rynke.source.${event.kind}`)} · ${i18n.formatDate(`${event.event_date}T00:00:00Z`)}`;
}

/** One form deciding the requests of `athleteIds` at `eventId`. */
function decideForm(
	eventId: number,
	athleteIds: readonly number[],
	decision: Decision,
	back: string,
	button: SafeHtml,
): SafeHtml {
	const riders = athleteIds.map(
		(id) => html`<input type="hidden" name="athlete" value="${String(id)}">`,
	);
	return html`<form method="post" action="/organiser/requests" class="request-form"><input type="hidden" name="event" value="${String(eventId)}">${riders}<input type="hidden" name="decision" value="${decision}"><input type="hidden" name="back" value="${back}">${button}</form>`;
}

/** Eintragen and ✕ for one rider's request. */
function decideButtons(
	i18n: I18n,
	row: OpenRequestRow,
	back: string,
): SafeHtml {
	const event = eventLabel(i18n, row);
	const names = { name: row.first_name, event };
	const yes = html`<button class="request-yes" aria-label="${i18n.t("organiser.requests.confirm.label", names)}">${CHECK}<span>${i18n.t("organiser.requests.confirm")}</span></button>`;
	const no = html`<button class="request-no" aria-label="${i18n.t("organiser.requests.deny.label", names)}">${CLOSE}</button>`;
	return html`${decideForm(row.event_id, [row.athlete_id], "confirm", back, yes)}${decideForm(row.event_id, [row.athlete_id], "deny", back, no)}`;
}

/**
 * The open requests grouped by event, newest event first (FR-031). `listed`
 * are all listed riders, so a profile link tells apart riders sharing a first
 * name (004 FR-022).
 */
export function openRequestsBlock(
	i18n: I18n,
	rows: readonly OpenRequestRow[],
	back: string,
	listed: readonly ListedRiderRow[],
): SafeHtml | null {
	if (rows.length === 0) return null;
	const links = new Map(
		withProfileLinks([...listed]).map((r) => [r.athlete_id, r.profileLink]),
	);
	const groups = new Map<number, OpenRequestRow[]>();
	for (const row of rows) {
		groups.set(row.event_id, [...(groups.get(row.event_id) ?? []), row]);
	}
	const count = i18n.formatNumber(rows.length, { fractionDigits: 0 });
	const heading =
		rows.length === 1
			? i18n.t("organiser.requests.heading.one")
			: i18n.t("organiser.requests.heading", { n: count });
	const intro =
		groups.size === 1
			? i18n.t("organiser.requests.intro.one")
			: i18n.t("organiser.requests.intro", { n: String(groups.size) });
	const sections = [...groups.values()].map((group) => {
		const first = group[0] as OpenRequestRow;
		const items = group.map((row) => {
			const link = links.get(row.athlete_id) ?? null;
			const profile =
				link === null
					? null
					: html` <a class="rider-profile" href="${link}">${i18n.t("organiser.attendance.profile")}</a>`;
			return html`<li class="request"><span class="request-rider"><span class="rider-name">${row.first_name}</span>${profile}</span>${decideButtons(i18n, row, back)}</li>
`;
		});
		const all =
			group.length > 1
				? decideForm(
						first.event_id,
						group.map((r) => r.athlete_id),
						"confirm",
						back,
						html`<button class="button-outlined">${i18n.t("organiser.requests.confirmAll", { n: String(group.length) })}</button>`,
					)
				: null;
		return html`<div class="request-event">
<div class="request-event-head"><p>${eventLabel(i18n, first)}</p><a href="/organiser/events/${first.event_id}">${i18n.t("organiser.requests.open")}</a></div>
<ul class="requests">
${items}</ul>
${all}</div>
`;
	});
	return html`<section class="open-requests" aria-labelledby="open-requests">
<h2 id="open-requests">${heading}</h2>
<p>${intro}</p>
${sections}</section>
`;
}

/** One line per open request of a rider, for the overview (FR-034). */
export function riderRequestLines(
	i18n: I18n,
	rows: readonly OpenRequestRow[],
	back: string,
): SafeHtml | null {
	if (rows.length === 0) return null;
	const lines = rows.map(
		(row) =>
			html`<li class="request"><a class="request-chip" href="/organiser/events/${row.event_id}">${i18n.t("organiser.requests.wants", { event: eventLabel(i18n, row) })}</a>${decideButtons(i18n, row, back)}</li>
`,
	);
	return html`<ul class="requests rider-requests">
${lines}</ul>
`;
}

/**
 * The notice of a decision with its undo form, from `?done=confirmed` or
 * `?done=denied` and `&undo=`; null otherwise or when the token has expired.
 */
export async function decisionNotice(
	url: URL,
	ctx: Ctx,
	i18n: I18n,
	back: string,
): Promise<SafeHtml | null> {
	const done = url.searchParams.get("done");
	if (done !== "confirmed" && done !== "denied") return null;
	const token = url.searchParams.get("undo") ?? "";
	const undo = await readUndoToken(
		token,
		ctx.now(),
		ctx.env.SESSION_SIGNING_KEY,
	);
	if (!undo) return null;
	const ids = undo.reports.map((r) => r.athleteId);
	const { results } = await ctx.env.DB.prepare(
		`SELECT first_name FROM riders WHERE athlete_id IN (SELECT value FROM json_each(?))
		ORDER BY first_name COLLATE NOCASE, athlete_id`,
	)
		.bind(JSON.stringify(ids))
		.all<{ first_name: string }>();
	const names = results.map((r) => r.first_name).join(", ");
	const text = i18n.t(`organiser.done.${done}`, { names });
	return html`<div class="notice notice-undo" role="status"><p>${text}</p><form method="post" action="/organiser/requests/undo"><input type="hidden" name="token" value="${token}"><input type="hidden" name="back" value="${back}"><button class="button-outlined">${i18n.t("organiser.undo")}</button></form></div>
`;
}

/** `POST /organiser/requests`: confirm or deny requests (FR-031, FR-034). */
export async function handleDecideRequests(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const rider = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		"/organiser/requests",
	);
	if (rider instanceof Response) return rider;
	const form = await request.formData();
	const back = safeBack(form.get("back"));
	const fail = (code: string) =>
		redirect(withQuery(back, `error=${code}`), 303);
	const decision = form.get("decision");
	const eventId = Number(form.get("event"));
	const asked = new Set(form.getAll("athlete").map(Number));
	if (
		(decision !== "confirm" && decision !== "deny") ||
		!Number.isSafeInteger(eventId)
	) {
		return fail("request_settled");
	}
	const db = ctx.env.DB;
	const [eventRows, reportRows] = await db.batch([
		readTeamEventStatement(db, eventId),
		listEventReportsStatement(db, eventId),
	]);
	const event = (eventRows?.results as TeamEventRecordRow[] | undefined)?.[0];
	if (!event) return fail("event_missing");
	if (!hasTakenPlace(event.event_date, berlinDate(ctx.now()))) {
		return fail("future_event");
	}
	// Only requests still open: one another organiser settled meanwhile stays
	// as it is (spec edge cases).
	const reports = (
		(reportRows?.results ?? []) as { athlete_id: number; reported_at: number }[]
	)
		.filter((r) => asked.has(r.athlete_id))
		.map((r) => ({ athleteId: r.athlete_id, reportedAt: r.reported_at }));
	if (reports.length === 0) return fail("request_settled");
	const athleteIds = reports.map((r) => r.athleteId);
	if (decision === "confirm") {
		await teamEventChange(ctx, {
			kind: "add-attendance",
			eventId,
			athleteIds,
			by: rider.athleteId,
		});
	} else {
		await deleteReportsStatement(db, eventId, athleteIds).run();
	}
	const token = await undoToken(
		{ decision, eventId, reports },
		ctx.now(),
		ctx.env.SESSION_SIGNING_KEY,
	);
	const done = decision === "confirm" ? "confirmed" : "denied";
	return redirect(
		withQuery(back, `done=${done}&undo=${encodeURIComponent(token)}`),
		303,
	);
}

/** `POST /organiser/requests/undo`: puts the last decision back (FR-032). */
export async function handleUndoRequests(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const rider = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		"/organiser/requests/undo",
	);
	if (rider instanceof Response) return rider;
	const form = await request.formData();
	const back = safeBack(form.get("back"));
	const token = form.get("token");
	const undo =
		typeof token === "string"
			? await readUndoToken(token, ctx.now(), ctx.env.SESSION_SIGNING_KEY)
			: null;
	if (!undo) return redirect(withQuery(back, "error=undo_expired"), 303);
	const athleteIds = undo.reports.map((r) => r.athleteId);
	const db = ctx.env.DB;
	try {
		if (undo.decision === "confirm") {
			await teamEventChange(ctx, {
				kind: "remove-attendance",
				eventId: undo.eventId,
				athleteIds,
			});
		}
	} catch (error) {
		// The event is gone meanwhile: there is nothing to put back.
		if (error instanceof TeamEventRefused) {
			return redirect(withQuery(back, "error=undo_expired"), 303);
		}
		throw error;
	}
	await db.batch(
		undo.reports.map((r) =>
			insertReportStatement(db, undo.eventId, r.athleteId, r.reportedAt),
		),
	);
	return redirect(withQuery(back, "done=undone"), 303);
}
