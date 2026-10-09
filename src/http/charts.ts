import { html, type SafeHtml } from "./html";

// The Team page's charts as inline SVG (feature 016 research R5, R12): no
// library and no client script. Each stretches to its box, so the stroke keeps
// its width with `vector-effect`; the label carries the figures.

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
