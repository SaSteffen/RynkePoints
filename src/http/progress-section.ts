import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { miniCoin } from "./coin";
import { html, SafeHtml } from "./html";
import type {
	ChartSeries,
	Earned,
	Preset,
	ProgressView,
} from "./progress-view";

// The Overview's progress section (feature 009 contracts/overview-section.md):
// the markup around the two canvases that `progressCharts()` in
// `public/app.js` draws on. Every word is here, from the catalogs; the script
// only fills the `data-slot` spans of the templates with dates and numbers
// (research R9). The weekly table is the charts' text version (FR-050).

/** The chart library, as `pnpm vendor` names it (research R6). */
export const CHART_SCRIPTS: readonly string[] = [
	"/vendor/chart-4.5.1.umd.min.js",
	"/vendor/chartjs-plugin-zoom-2.2.0.min.js",
];

type Ready = Extract<ProgressView, { state: "ready" }>;

const PERIOD_LABELS: Record<Preset, MessageId> = {
	season: "progress.period.season",
	"3m": "progress.period.3m",
	"4w": "progress.period.4w",
};

/** An empty placeholder the script fills (research R9). */
const slot = (name: string) =>
	new SafeHtml(`<span data-slot="${name}"></span>`);

const date = (i18n: I18n, day: string) => i18n.formatDate(`${day}T00:00:00Z`);

const whole = (i18n: I18n, n: number) =>
	i18n.formatNumber(n, { fractionDigits: 0 });

function renderChart(
	i18n: I18n,
	view: Ready,
	kind: "training" | "team",
): SafeHtml {
	const series: ChartSeries = view[kind];
	const label: MessageId =
		kind === "training" ? "progress.chart.training" : "progress.chart.team";
	const outside = kind === "training" ? view.outside : null;
	// The whole season at first; the script refills it on every change.
	const ariaLabel = i18n.t(label, {
		from: date(i18n, view.seasonStart),
		to: date(i18n, view.deadline),
		value: whole(i18n, series.values[view.lastIndex] ?? 0),
		threshold: whole(i18n, series.threshold),
	});
	const legend = [
		html`<li><span class="progress-key key-curve" aria-hidden="true"></span>${i18n.t(`rynke.${kind}`)}</li>`,
		html`<li><span class="progress-key key-threshold" aria-hidden="true"></span>${i18n.t("progress.legend.threshold", { value: whole(i18n, series.threshold) })}</li>`,
		series.pace
			? html`<li><span class="progress-key key-pace" aria-hidden="true"></span>${i18n.t("progress.legend.pace")}</li>`
			: null,
		outside
			? html`<li><span class="progress-key key-outside" aria-hidden="true"></span>${i18n.t("rynke.withoutVirtual")}</li>
<li><span class="progress-key key-needed" aria-hidden="true"></span>${i18n.t("progress.legend.needed", { value: whole(i18n, outside.needed) })}</li>`
			: null,
	];
	return html`<figure class="progress-chart progress-${kind}">
<figcaption>${miniCoin(kind)}${i18n.t(`rynke.${kind}`)}</figcaption>
<div class="progress-plot"><canvas data-series="${kind}" role="img" tabindex="0" aria-describedby="progress-help" aria-label="${ariaLabel}"></canvas></div>
<template data-label="${kind}">${i18n.tHtml(label, {
		from: slot("from"),
		to: slot("to"),
		value: slot("value"),
		threshold: slot("threshold"),
	})}</template>
<ul class="progress-legend">${legend}</ul>
</figure>
`;
}

/** The ahead, behind and on-pace parts of the readout for one line (US2). */
function paceTemplates(
	i18n: I18n,
	series: "training" | "team" | "outside",
): SafeHtml {
	const name = i18n.t(
		series === "outside" ? "rynke.withoutVirtual" : `rynke.${series}`,
	);
	const part = (readout: string, id: MessageId, params: string[]) =>
		html`<template data-readout="${readout}" data-series="${series}">${i18n.tHtml(
			"progress.day.series",
			{
				series: name,
				text: i18n.tHtml(
					id,
					Object.fromEntries(params.map((p) => [p, slot(p)])),
				),
			},
		)}</template>
`;
	return html`${part("pace-ahead", "progress.day.ahead", ["n", "pace"])}${part("pace-behind", "progress.day.behind", ["n", "pace"])}${part("pace-on", "progress.day.onPace", ["pace"])}`;
}

function renderTable(i18n: I18n, view: Ready): SafeHtml {
	const cells = (e: Earned | null) =>
		e
			? html`<td class="num">${whole(i18n, e.earned)}</td><td class="num">${whole(i18n, e.total)}</td>`
			: null;
	const head = (id: MessageId) =>
		html`<th scope="col">${i18n.t(id)}</th><th scope="col">${i18n.t("progress.table.total")}</th>`;
	const rows = view.weeks.map(
		(week) =>
			html`<tr><th scope="row">${date(i18n, week.firstDay)}</th>${cells(week.training)}${cells(week.team)}${cells(week.outside)}</tr>
`,
	);
	return html`<details class="progress-table">
<summary>${i18n.t("progress.table.summary")}</summary>
<div class="progress-table-scroll"><table>
<thead><tr><th scope="col">${i18n.t("progress.table.week")}</th>${head("rynke.training")}${head("rynke.team")}${view.outside ? head("rynke.withoutVirtual") : null}</tr></thead>
<tbody>
${rows}</tbody>
</table></div>
</details>
`;
}

/**
 * The chart data for the script (data-model.md "Chart data"): dates and whole
 * numbers only, with `<` escaped so it can't end the script element.
 */
function chartData(view: Ready): SafeHtml {
	const line = (s: ChartSeries) => ({
		values: s.values,
		threshold: s.threshold,
		yMax: s.yMax,
		pace: s.pace,
	});
	const json = JSON.stringify({
		axisDays: view.axisDays,
		lastIndex: view.lastIndex,
		seasonStart: view.seasonStart,
		training: line(view.training),
		team: line(view.team),
		outside: view.outside
			? { ...line(view.outside), needed: view.outside.needed }
			: null,
	});
	return new SafeHtml(json.replaceAll("<", "\\u003c"));
}

/** The section, or nothing when the view has none (FR-016, FR-040). */
export function renderProgress(
	i18n: I18n,
	view: ProgressView,
): SafeHtml | null {
	if (view.state !== "ready") return null;
	const shown = view.presets.map(
		({ preset, from, to }) =>
			html`<button type="button" class="chip" data-from="${from}" data-to="${to}" aria-pressed="${preset === "season" ? "true" : "false"}">${i18n.t(PERIOD_LABELS[preset])}</button>
`,
	);
	return html`<section id="progress" class="progress card card-outlined" aria-labelledby="progress-heading" data-locale="${i18n.t("meta.intlLocale")}">
<h2 id="progress-heading">${i18n.t("progress.heading")}</h2>
<p class="progress-rules">${i18n.t("progress.rules", { version: String(view.rulesVersion) })}</p>
${view.nothingYet ? html`<p class="progress-nothing">${i18n.t("progress.nothingYet")}</p>\n` : null}<div class="progress-periods" role="group" aria-label="${i18n.t("progress.periods.label")}">
${shown}<span class="progress-move" hidden>
<button type="button" class="button-text" data-move="-1">${i18n.t("progress.earlier")}</button>
<button type="button" class="button-text" data-move="1">${i18n.t("progress.later")}</button>
<button type="button" class="button-text" data-reset>${i18n.t("progress.reset")}</button>
</span>
</div>
${renderChart(i18n, view, "training")}${renderChart(i18n, view, "team")}<p class="progress-readout" aria-live="polite"></p>
<p id="progress-help" class="progress-help">${i18n.t("progress.help")}</p>
<template data-readout="day">${i18n.tHtml("progress.day", {
		date: slot("date"),
		training: slot("training"),
		team: slot("team"),
	})}</template>
${view.training.pace ? paceTemplates(i18n, "training") : null}${view.team.pace ? paceTemplates(i18n, "team") : null}${
	view.outside
		? html`${paceTemplates(i18n, "outside")}<template data-readout="outside"> · ${i18n.tHtml(
				"progress.day.outside",
				{ value: slot("value") },
			)}</template>
`
		: null
}${renderTable(i18n, view)}<script type="application/json" id="progress-data">${chartData(view)}</script>
</section>
`;
}
