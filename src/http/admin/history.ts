import type { UsageRecord } from "../../db/usage";
import type { I18n } from "../../i18n/i18n";
import type { RecordedAllowance } from "../../usage/allowances";
import { levelOf, percentOf } from "../../usage/figures";
import { dailyBars } from "../charts";
import { html, type SafeHtml } from "../html";
import { amount, whole } from "./access";

// An allowance's history on `/admin` (feature 025 US2, FR-013 to FR-015, research
// R10): one value per day since recording began, as a graph and, when asked for,
// the same figures as a table. A day without a record is a gap, never zero.
//
// Thirteen months of eight allowances are over 3,000 days on one page, and a free
// Worker has 10 ms of CPU per request. So the graphs are one path each with raw
// values for `public/app.js` to word on hovering, and only the table asked for
// (`?days=<id>`) is built, a link away and with no script needed.

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

function dayTable(
	i18n: I18n,
	id: RecordedAllowance,
	days: readonly string[],
	byDay: ReadonlyMap<string, UsageRecord>,
): SafeHtml {
	// Only Strava's have the team's count and the peak; connected riders the count.
	const strava = id.startsWith("strava");
	const hasTeam = [...byDay.values()].some(
		(record) => record.teamUsed !== null,
	);
	return html`<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr><th scope="col">${i18n.t("admin.history.day")}</th><th scope="col">${i18n.t("admin.history.used")}</th><th scope="col">${i18n.t("admin.history.limit")}</th><th scope="col">${i18n.t("admin.history.share")}</th>${strava ? html`<th scope="col">${i18n.t("admin.history.team")}</th><th scope="col">${i18n.t("admin.history.peak")}</th>` : null}</tr></thead>
<tbody>
${[...days].reverse().map((day) => row(i18n, id, day, byDay.get(day), strava))}</tbody>
</table></div>
${!strava && hasTeam ? html`<p class="usage-detail">${i18n.t("admin.history.ridersNote")}</p>` : null}
</div>
`;
}

/** The graph and table of one allowance, or null if nothing of it is recorded. */
export type DailyHistory = (id: RecordedAllowance) => SafeHtml | null;

/**
 * Splits `records` (every allowance's, oldest first) by allowance. All graphs run
 * over the same days, so a spike on one can be found on the others.
 */
export function dailyHistory(
	i18n: I18n,
	records: readonly UsageRecord[],
	today: string,
	openDays: RecordedAllowance | null,
): DailyHistory {
	const first = records[0]?.day ?? today;
	const days = daysBetween(first, today);
	const firstLabel = dayLabel(i18n, first);
	const lastLabel = dayLabel(i18n, today);
	const numbers = i18n.t("admin.figure.numbers", {
		used: "{used}",
		limit: "{limit}",
		percent: "{percent}",
	});
	const gap = i18n.t("admin.history.gap");
	const locale = i18n.t("meta.intlLocale");
	return (id) => {
		const own = records.filter((record) => record.allowance === id);
		if (own.length === 0) return null;
		const byDay = new Map(own.map((record) => [record.day, record]));
		const onDays = days.map((day) => byDay.get(day));
		const open = id === openDays;
		const storage =
			id === "cf_d1_storage_bytes"
				? html` data-gb="${i18n.t("admin.gigabytes", { n: "{n}" })}"`
				: null;
		return html`<div class="usage-graph" data-locale="${locale}" data-first="${first}" data-numbers="${numbers}" data-gap="${gap}"${storage} data-days="${onDays
			.map((record) => (record ? `${record.used}/${record.limit}` : ""))
			.join(",")}">${dailyBars(
			onDays.map((record) => ({
				share:
					record && record.limit > 0
						? (record.used * 100) / record.limit
						: null,
				level: record ? levelOf(record.used, record.limit) : "ok",
			})),
			i18n.t("admin.history.chart", {
				name: i18n.t(`admin.allowance.${id}`),
				first: firstLabel,
				last: lastLabel,
			}),
		)}</div><p class="usage-axis"><span>${firstLabel}</span><span class="usage-axis-limit">${i18n.t("admin.history.limit")}</span><span>${lastLabel}</span></p>
<a class="usage-table-link" href="${open ? `/admin#${id}` : `/admin?days=${id}#${id}`}">${i18n.t(open ? "admin.history.hideDays" : "admin.history.days")}</a>
${open ? dayTable(i18n, id, days, byDay) : null}`;
	};
}
