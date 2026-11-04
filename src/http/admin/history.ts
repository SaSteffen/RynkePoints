import type { Ctx } from "../../ctx";
import { readHistory, type UsageRecord } from "../../db/usage";
import type { I18n } from "../../i18n/i18n";
import {
	historyStart,
	isRecordedAllowance,
	RECORDED_ALLOWANCES,
	type RecordedAllowance,
	utcDay,
} from "../../usage/allowances";
import { percentOf } from "../../usage/figures";
import { dailyBars } from "../charts";
import { html, type SafeHtml } from "../html";
import { adminPage, adminSwitch, whole } from "./access";
import { amount } from "./usage";

// An allowance's history at `/admin/history` (feature 025 US2, FR-013 to FR-015,
// research R10): one value per day since recording began, as a chart and the same
// figures as a table. A day without a record is a gap, never zero.

/** Every UTC day from `first` to `last`, oldest first. */
function daysBetween(first: string, last: string): string[] {
	const days: string[] = [];
	const date = new Date(`${first}T00:00:00Z`);
	const end = new Date(`${last}T00:00:00Z`).getTime();
	while (date.getTime() <= end) {
		days.push(date.toISOString().slice(0, 10));
		date.setUTCDate(date.getUTCDate() + 1);
	}
	return days;
}

/** A plain GET form: on a phone, eight links would push the chart off the screen. */
function allowanceChoice(i18n: I18n, current: RecordedAllowance): SafeHtml {
	const options = RECORDED_ALLOWANCES.map(
		(id) =>
			html`<option value="${id}"${id === current ? html` selected` : null}>${i18n.t(`admin.allowance.${id}`)}</option>
`,
	);
	return html`<form class="usage-choice" method="get" action="/admin/history">
<label for="usage-allowance">${i18n.t("admin.history.choose")}</label>
<select id="usage-allowance" name="allowance">
${options}</select>
<button class="button-outlined">${i18n.t("admin.history.show")}</button>
</form>
`;
}

function dayLabel(i18n: I18n, day: string): string {
	return i18n.formatDate(`${day}T00:00:00Z`);
}

function row(
	i18n: I18n,
	id: RecordedAllowance,
	day: string,
	record: UsageRecord | undefined,
	strava: boolean,
): SafeHtml {
	const cell = (value: number | null) =>
		html`<td>${value === null ? "" : whole(i18n, value)}</td>`;
	if (!record) {
		return html`<tr class="usage-gap"><th scope="row">${dayLabel(i18n, day)}</th><td colspan="${strava ? 5 : 3}">${i18n.t("admin.history.gap")}</td></tr>
`;
	}
	return html`<tr><th scope="row">${dayLabel(i18n, day)}</th><td>${amount(i18n, id, record.used)}</td><td>${amount(i18n, id, record.limit)}</td><td>${i18n.t("admin.history.percent", { n: whole(i18n, percentOf(record.used, record.limit)) })}</td>${strava ? html`${cell(record.teamUsed)}${cell(record.peak15m)}` : null}</tr>
`;
}

export function handleAdminHistory(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const url = new URL(request.url);
	return adminPage(
		request,
		ctx,
		i18n,
		`/admin/history${url.search}`,
		async () => {
			const asked = url.searchParams.get("allowance") ?? "";
			const allowance: RecordedAllowance = isRecordedAllowance(asked)
				? asked
				: RECORDED_ALLOWANCES[0];
			const today = utcDay(ctx.now());
			const kept = historyStart(today);
			const { records, firstDay } = await readHistory(
				ctx.env.DB,
				allowance,
				kept,
			);
			const name = i18n.t(`admin.allowance.${allowance}`);
			const head = html`${adminSwitch(i18n, "history")}${allowanceChoice(i18n, allowance)}`;
			if (firstDay === null) {
				return html`${head}<p class="notice">${i18n.t("admin.history.none")}</p>
`;
			}
			const first = [firstDay, kept].sort().at(-1) ?? kept;
			const byDay = new Map(records.map((record) => [record.day, record]));
			const days = daysBetween(first, today);
			// Only Strava's have the team's count and the peak; connected riders the count.
			const strava = allowance.startsWith("strava");
			const hasTeam = records.some((record) => record.teamUsed !== null);
			const shares = days.map((day) => {
				const record = byDay.get(day);
				return record && record.limit > 0
					? (record.used * 100) / record.limit
					: null;
			});
			return html`${head}<section class="card">
<h2>${name}</h2>
<p class="usage-detail">${i18n.t("admin.history.since", { date: dayLabel(i18n, firstDay) })}</p>
${dailyBars(shares, i18n.t("admin.history.chart", { name, first: dayLabel(i18n, first), last: dayLabel(i18n, today) }))}
<div class="progress-table progress-table-scroll"><table>
<thead><tr><th scope="col">${i18n.t("admin.history.day")}</th><th scope="col">${i18n.t("admin.history.used")}</th><th scope="col">${i18n.t("admin.history.limit")}</th><th scope="col">${i18n.t("admin.history.share")}</th>${strava ? html`<th scope="col">${i18n.t("admin.history.team")}</th><th scope="col">${i18n.t("admin.history.peak")}</th>` : null}</tr></thead>
<tbody>
${[...days].reverse().map((day) => row(i18n, allowance, day, byDay.get(day), strava))}</tbody>
</table></div>
${!strava && hasTeam ? html`<p class="usage-detail">${i18n.t("admin.history.ridersNote")}</p>` : null}
</section>
`;
		},
	);
}
