import { html, type SafeHtml } from "./html";

// The Team page's charts as inline SVG (feature 016 research R5, R12): no
// library and no client script. The sparkline and the bars stretch to their
// box, so the strokes keep their width with `vector-effect`. The label carries
// the figures. Feature 019 removed the peloton (research R12).

const WIDTH = 100;
const HEIGHT = 24;
/** Keeps the stroke inside the box at the top and bottom. */
const INSET = 2;

/** One decimal is finer than any screen draws the box. */
const coord = (value: number) => String(Math.round(value * 10) / 10);

/** A rising line of `values`, lowest at the bottom; flat when all are 0. */
export function sparkline(values: readonly number[], label: string): SafeHtml {
	const max = Math.max(0, ...values);
	const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
	const points = values
		.map((value, i) => {
			const x = values.length > 1 ? i * step : WIDTH;
			const share = max > 0 ? value / max : 0;
			const y = HEIGHT - INSET - share * (HEIGHT - 2 * INSET);
			return `${coord(x)},${coord(y)}`;
		})
		.join(" ");
	return html`<svg class="sparkline" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}"><polyline points="${points}" vector-effect="non-scaling-stroke"/></svg>`;
}

const BARS_WIDTH = 100;
const BARS_HEIGHT = 120;
/** The share of each week's slot the bar fills. */
const BAR_SHARE = 0.8;

/** One bar per week's team total, the last one the current week. */
export function weekBars(totals: readonly number[], label: string): SafeHtml {
	const max = Math.max(0, ...totals);
	const slot = totals.length > 0 ? BARS_WIDTH / totals.length : 0;
	const bars = totals.map((total, i) => {
		const height = max > 0 ? (total / max) * BARS_HEIGHT : 0;
		const current =
			i === totals.length - 1
				? html` class="current" vector-effect="non-scaling-stroke"`
				: null;
		return html`<rect${current} x="${coord(i * slot + (slot * (1 - BAR_SHARE)) / 2)}" y="${coord(BARS_HEIGHT - height)}" width="${coord(slot * BAR_SHARE)}" height="${coord(height)}"/>`;
	});
	return html`<svg class="week-bars" viewBox="0 0 ${BARS_WIDTH} ${BARS_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}">${bars}</svg>`;
}

const THRESHOLD_WIDTH = 100;
const THRESHOLD_HEIGHT = 10;

/**
 * `value` as a filled bar against `threshold`, with a tick at the even pace
 * when `pace` is set. Decoration: the card or table cell carries the figures.
 */
export function thresholdBars(
	value: number,
	threshold: number,
	pace: number | null,
): SafeHtml {
	const share = (n: number) =>
		threshold > 0 ? Math.min(1, Math.max(0, n / threshold)) : 1;
	const tick =
		pace === null
			? null
			: html`<line class="pace-mark" x1="${coord(share(pace) * THRESHOLD_WIDTH)}" x2="${coord(share(pace) * THRESHOLD_WIDTH)}" y1="0" y2="${THRESHOLD_HEIGHT}" vector-effect="non-scaling-stroke"/>`;
	return html`<svg class="threshold-bar" viewBox="0 0 ${THRESHOLD_WIDTH} ${THRESHOLD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="threshold-track" y="2" width="${THRESHOLD_WIDTH}" height="6" rx="3"/><rect class="threshold-fill" y="2" width="${coord(share(value) * THRESHOLD_WIDTH)}" height="6" rx="3"/>${tick}</svg>`;
}
