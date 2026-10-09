import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	type CorrectionRow,
	listRiderCorrectionsStatement,
} from "../../db/corrections";
import {
	type ListedRider,
	type ListedRiderRow,
	listListedRidersStatement,
	withProfileLinks,
} from "../../db/organiser";
import type { I18n } from "../../i18n/i18n";
import { CorrectionRefused, correctionChange } from "../../rynke/apply";
import { notFound } from "../errors";
import { html, type SafeHtml } from "../html";
import {
	changeRecord,
	noticeFromQuery,
	organiserPage,
	redirectWith,
	requireOrganiserPost,
} from "./access";

// A rider's corrections (feature 014 Story 3, contracts/http-routes.md): the
// listed riders at `/organiser/riders`, and each rider's corrections with an
// add form at `/organiser/riders/{id}`. Every change goes through
// `correctionChange`, so the rider's Rynke follow (FR-030, FR-031). The pages
// show no balances (FR-042).

const LIST = "/organiser/riders";

const riderPath = (id: number) => `/organiser/riders/${id}`;

async function listedRiders(ctx: Ctx): Promise<ListedRider[]> {
	const { results } = await listListedRidersStatement(
		ctx.env.DB,
	).all<ListedRiderRow>();
	return withProfileLinks(results);
}

/** The form's fields; an empty amount is 0, anything else not a number NaN. */
async function correctionForm(request: Request) {
	const form = await request.formData();
	const field = (key: string) => {
		const value = form.get(key);
		return typeof value === "string" ? value : "";
	};
	const amount = (key: string) => {
		const value = field(key).trim();
		return value === "" ? 0 : Number(value);
	};
	return {
		training: amount("training"),
		team: amount("team"),
		reason: field("reason"),
		date: field("date"),
	};
}

/** `+10` or `−20`. */
function signed(n: number): string {
	return n > 0 ? `+${n}` : `−${-n}`;
}

function correctionItem(i18n: I18n, correction: CorrectionRow): SafeHtml {
	const amounts = [
		correction.training === 0
			? null
			: i18n.t("organiser.corrections.training", {
					amount: signed(correction.training),
				}),
		correction.team === 0
			? null
			: i18n.t("organiser.corrections.team", {
					amount: signed(correction.team),
				}),
	].filter((a) => a !== null);
	return html`<li class="organiser-event">
<span class="organiser-event-title">${i18n.formatDate(`${correction.correction_date}T00:00:00Z`)} · ${amounts.join(" · ")}</span>
<span class="organiser-event-name">${correction.reason}</span>
${changeRecord(i18n, correction.changed_by_name, correction.changed_at)}
<details class="organiser-confirm">
<summary>${i18n.t("organiser.corrections.remove")}</summary>
<p>${i18n.t("organiser.corrections.removeWarning")}</p>
<form method="post" action="/organiser/corrections/${correction.correction_id}/delete"><button class="danger">${i18n.t("organiser.corrections.removeConfirm")}</button></form>
</details>
</li>`;
}

/** `GET /organiser/riders`: the listed riders by first name. */
export function handleOrganiserRiders(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return organiserPage(request, ctx, i18n, LIST, async () => {
		const riders = await listedRiders(ctx);
		const list =
			riders.length === 0
				? html`<p>${i18n.t("organiser.riders.none")}</p>`
				: html`<ul class="attendance-list">${riders.map(
						(r) =>
							html`<li class="attendance-rider"><a href="${riderPath(r.athlete_id)}" class="rider-name">${r.first_name}</a>${
								r.profileLink === null
									? ""
									: html` <a href="${r.profileLink}">${i18n.t("organiser.attendance.profile")}</a>`
							}</li>`,
					)}</ul>`;
		return html`${noticeFromQuery(new URL(request.url), i18n)}
<section class="organiser">
<p><a href="/organiser">${i18n.t("organiser.back")}</a></p>
<h2>${i18n.t("organiser.riders.heading")}</h2>
${list}
</section>`;
	});
}

/** `GET /organiser/riders/{id}`: the rider's corrections and a new one. */
export function handleOrganiserRider(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<Response> {
	const path = riderPath(athleteId);
	return organiserPage(request, ctx, i18n, path, async () => {
		const rider = (await listedRiders(ctx)).find(
			(r) => r.athlete_id === athleteId,
		);
		if (!rider) return notFound(i18n, path);
		const { results } = await listRiderCorrectionsStatement(
			ctx.env.DB,
			athleteId,
		).all<CorrectionRow>();
		const list =
			results.length === 0
				? html`<p>${i18n.t("organiser.corrections.none")}</p>`
				: html`<ul class="organiser-events">${results.map((c) => correctionItem(i18n, c))}</ul>`;
		return html`${noticeFromQuery(new URL(request.url), i18n)}
<section class="organiser">
<p><a href="${LIST}">${i18n.t("organiser.riders.back")}</a></p>
<h2>${i18n.t("organiser.corrections.heading", { name: rider.first_name })}</h2>
${list}
<h2>${i18n.t("organiser.corrections.new")}</h2>
<form method="post" action="${path}/corrections" class="organiser-form">
<label>${i18n.t("organiser.field.training")}<input type="number" name="training" step="1" min="-10000" max="10000"></label>
<label>${i18n.t("organiser.field.team")}<input type="number" name="team" step="1" min="-10000" max="10000"></label>
<label>${i18n.t("organiser.field.reason")}<input type="text" name="reason" maxlength="200" required></label>
<label>${i18n.t("organiser.field.date")}<input type="date" name="date" value="${berlinDate(ctx.now())}" required></label>
<button class="button">${i18n.t("organiser.add")}</button>
</form>
</section>`;
	});
}

/** `POST /organiser/riders/{id}/corrections`: a new correction (FR-031). */
export async function handleAddCorrection(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<Response> {
	const path = riderPath(athleteId);
	const organiser = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		`${path}/corrections`,
	);
	if (organiser instanceof Response) return organiser;
	const correction = await correctionForm(request);
	if (!(await listedRiders(ctx)).some((r) => r.athlete_id === athleteId)) {
		return redirectWith(LIST, "error", "rider_not_listed");
	}
	try {
		await correctionChange(ctx, {
			kind: "add-correction",
			athleteId,
			correction,
			by: organiser.athleteId,
		});
		return redirectWith(path, "done", "added");
	} catch (error) {
		if (error instanceof CorrectionRefused) {
			return redirectWith(path, "error", error.code);
		}
		throw error;
	}
}

/** `POST /organiser/corrections/{id}/delete`: the correction (FR-031). */
export async function handleRemoveCorrection(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	correctionId: number,
): Promise<Response> {
	const organiser = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		`/organiser/corrections/${correctionId}/delete`,
	);
	if (organiser instanceof Response) return organiser;
	try {
		const { athleteId } = await correctionChange(ctx, {
			kind: "remove-correction",
			correctionId,
		});
		return redirectWith(riderPath(athleteId), "done", "removed");
	} catch (error) {
		if (error instanceof CorrectionRefused) {
			return redirectWith(LIST, "error", error.code);
		}
		throw error;
	}
}
