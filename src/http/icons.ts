import { SafeHtml } from "./html";

// Inline stroke icons from the approved mock-up (feature 011 research R3). They
// are decorative: the link or button around them carries the text, so each is
// hidden from screen readers and takes the colour of its text.

const icon = (paths: string): SafeHtml =>
	new SafeHtml(
		`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`,
	);

/** One rider: the larger figure of PEOPLE, centred, for the "you" tab. */
export const PERSON = icon(
	'<circle cx="12" cy="8" r="3.75"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
);

export const BIKE = icon(
	'<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5"/><path d="M9 9l3 7.5L15 9"/><path d="M8 6h3"/>',
);

export const PEOPLE = icon(
	'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5"/>',
);

/** A medal on its ribbon, for the badges. */
export const MEDAL = icon(
	'<path d="M8 3h8l-2.5 6h-3z"/><circle cx="12" cy="15" r="6"/><path d="M12 12.5v5"/>',
);

export const SLIDERS = icon(
	'<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
);

export const CLIPBOARD = icon(
	'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
);

/** A dial near its end, for the usage figures (feature 025). */
export const GAUGE = icon(
	'<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-5"/><circle cx="12" cy="14" r="1.5"/>',
);

/** A rising line, for the usage history (feature 025). */
export const TREND = icon('<path d="M4 19h16"/><path d="m5 15 5-5 3 3 6-7"/>');

export const CALENDAR = icon(
	'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
);

export const REFRESH = icon(
	'<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
);

/**
 * Share, as each rider knows it (feature 033 research R8): Apple's box with an
 * arrow on iPhone and iPad, three linked dots on Android and desktop. Both are
 * in the markup; the style shows one, since only iOS and iPadOS support
 * `-webkit-touch-callout`.
 */
const SHARE_PATHS = {
	apple:
		'<path d="M12 3v12"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/>',
	dots: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
};
export const SHARE = new SafeHtml(
	Object.entries(SHARE_PATHS)
		.map(([kind, paths]) =>
			icon(paths)
				.toString()
				.replace("<svg ", `<svg class="share-icon-${kind}" `),
		)
		.join(""),
);

/** Closes the app prompt (feature 015). */
export const CLOSE = icon('<path d="M6 6l12 12M18 6 6 18"/>');

/** A turning arrow, for the handle that turns and sizes a shared badge (feature 033). */
export const TURN = icon(
	'<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4v3.5h-3.5"/>',
);

/** A tick, for "Bin dabei ✓" and confirmed attendance (feature 019). */
export const CHECK = icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>');

/** A chevron pointing down, for the hint's "Zur Karte" (feature 034). */
export const CHEVRON_DOWN = icon('<path d="M6 9l6 6 6-6"/>');

/** A plus, for "Bin dabei" and "Ich war auch dabei" (feature 019). */
export const PLUS = icon('<path d="M12 5v14M5 12h14"/>');

/** A painter's palette, for the theme menu (feature 022, the canvas's path). */
export const PALETTE = icon(
	'<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.2" r="1.2" fill="currentColor"/>',
);

// The Settings rows' icons (the settings redesign canvas).

/** A phone with an arrow down into it, for installing the app. */
export const INSTALL = icon(
	'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v6.5"/><path d="M9 10.5l3 3 3-3"/><path d="M10 18h4"/>',
);

export const BELL = icon(
	'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
);

/** The globe, for the language. */
export const LANGUAGE = icon(
	'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
);

/** Two sparkles, for the page-switch shows. */
export const SPARKLE = icon(
	'<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
);

/** A book, for the rules. */
export const BOOK = icon(
	'<path d="M5 19.5v-15A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5A1.5 1.5 0 0 0 6.5 21H19"/><path d="M9 7.5h6"/><path d="M9 11h4"/>',
);

/** A shield with a tick, for the consent. */
export const SHIELD = icon(
	'<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
);

/** A compass, for the tours. */
export const COMPASS = icon(
	'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
);

/** A clock turning back, for what's new. */
export const HISTORY = icon(
	'<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 3.5V8h4.5"/><path d="M12 8v4.5l3 2"/>',
);

export const SIGN_OUT = icon(
	'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
);

/** A screen and a phone, for every device. */
export const DEVICES = icon(
	'<rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M6 19h6"/><rect x="17.5" y="8" width="4.5" height="11" rx="1.2"/>',
);

export const TRASH = icon(
	'<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5"/><path d="M14 11v5.5"/>',
);

// Admin › Nutzung's rows (the usage redesign canvas, feature 048).

/** An octagon with an exclamation mark, for Kritisch. */
export const CRITICAL = icon(
	'<path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
);

/** A triangle with an exclamation mark, for Warnung. */
export const WARNING = icon(
	'<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
);

/** An "i" in a circle, for Hinweis and the state hints. */
export const INFO = icon(
	'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.01"/>',
);

/** A ticked circle, for "Alles im Rahmen". */
export const CHECK_CIRCLE = icon(
	'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9.5"/>',
);

/** A struck-through bell, for notifications on no device. */
export const BELL_OFF = icon(
	'<path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H5"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/><path d="m3 3 18 18"/>',
);

/** A bolt, for Strava's daily requests. */
export const BOLT = icon('<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>');

/** A clock, for Strava's 15-minute requests. */
export const CLOCK = icon(
	'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
);

/** A cloud, for the Worker requests. */
export const CLOUD = icon(
	'<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.6A3.2 3.2 0 0 0 7 18.5z"/>',
);

/** A database, for its rows and storage. */
export const DATABASE = icon(
	'<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
);

/** A list, for the queue operations. */
export const LIST = icon(
	'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
);
