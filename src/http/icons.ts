import { SafeHtml } from "./html";

// Inline stroke icons from the approved mock-up (feature 011 research R3). They
// are decorative: the link or button around them carries the text, so each is
// hidden from screen readers and takes the colour of its text.

const icon = (paths: string): SafeHtml =>
	new SafeHtml(
		`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`,
	);

/** The Rynke coin as a line: its rim and the chain ring (feature 012). */
export const COIN = icon(
	'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="2.2 1.8"/>',
);

export const BIKE = icon(
	'<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5"/><path d="M9 9l3 7.5L15 9"/><path d="M8 6h3"/>',
);

export const PEOPLE = icon(
	'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5"/>',
);

export const SLIDERS = icon(
	'<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
);

export const REFRESH = icon(
	'<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
);
