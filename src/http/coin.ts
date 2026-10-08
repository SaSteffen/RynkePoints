import { SafeHtml } from "./html";

// The Rynke coin, simplified from the team's coin for the app (feature 012
// FR-006, the Claude Design mock-up "RynkePoints Coin Explorations"). The
// sprite goes on every page once; each coin is a `<use>` of one side, so a
// page with many coins stays small. The colours come from the `--rp-coin-*`
// tokens through the `c-*` classes in `style.ts`. Every coin is decoration:
// the text next to it carries the figure (FR-004).

const STAR =
	"M0,-4 L0.94,-1.29 L3.8,-1.24 L1.52,0.49 L2.35,3.24 L0,1.6 L-2.35,3.24 L-1.52,0.49 L-3.8,-1.24 L-0.94,-1.29 Z";

/** The gold rim, the black ring with its two stars, and the face. */
const RIM = (face: string) =>
	`<circle class="c-rim" cx="50" cy="50" r="49"/><circle class="c-ink" cx="50" cy="50" r="45"/><circle class="${face}" cx="50" cy="50" r="31"/><path class="c-star" transform="translate(12 50)" d="${STAR}"/><path class="c-star" transform="translate(88 50)" d="${STAR}"/>`;

/** Training Rynke: the orangutan in his yellow helmet and jersey, in the chain. */
const FRONT = `${RIM("c-face")}<circle class="c-chain" cx="50" cy="50" r="29" stroke-width="3" stroke-dasharray="4 2.5"/><path class="c-yellow" d="M33,77 Q50,64 67,77 Q60,80 50,80 Q40,80 33,77 Z" stroke-width="1.4"/><circle class="c-fur" cx="34.5" cy="54" r="4.5" stroke-width="1.2"/><circle class="c-fur" cx="65.5" cy="54" r="4.5" stroke-width="1.2"/><circle class="c-fur" cx="50" cy="55" r="15" stroke-width="1.4"/><ellipse class="c-muzzle" cx="50" cy="60" rx="10" ry="7.5"/><ellipse class="c-ink" cx="45" cy="52" rx="1.9" ry="2.2"/><ellipse class="c-ink" cx="55" cy="52" rx="1.9" ry="2.2"/><circle class="c-ink" cx="48.4" cy="58" r="0.9"/><circle class="c-ink" cx="51.6" cy="58" r="0.9"/><path class="c-line" d="M44.5,61.5 Q50,66.5 55.5,61.5" stroke-width="1.5" stroke-linecap="round"/><path class="c-yellow" d="M34,48 Q34,34 50,34 Q66,34 66,48 Z" stroke-width="1.4" stroke-linejoin="round"/><path class="c-line" d="M45,35 L46,41 M55,35 L54,41 M50,34.5 L50,41" stroke-width="1.1" stroke-linecap="round"/>`;

/** Team Rynke: Hamburg to Paris – Elbphilharmonie, crane, Elbe, Eiffel Tower. */
const BACK = `${RIM("c-sky")}<path class="c-glass" d="M31,64 L31,47 Q34.5,43 38,46.5 Q41.5,41 46,45 L46,64 Z" stroke-width="1.2" stroke-linejoin="round"/><path class="c-brick" d="M31,56 L46,56 L46,64 L31,64 Z" stroke-width="1.2"/><path class="c-line" d="M24,64 L24,50 L29,46 M24,50 L27,54" stroke-width="1.3" stroke-linecap="round"/><path class="c-line" d="M67,64 L71,36 L75,64 M68.6,53 L73.4,53 M69.8,45 L72.2,45" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path class="c-water" d="M20.5,66 Q26,63 31,66 T42,66 T53,66 T64,66 T80,66 Q80.5,72 77,76 L23,76 Q19.5,72 20.5,66 Z"/><path class="c-yellow" d="M40,79 Q56,75 80.8,62 Q81,70 76,78 Q66,81 50,81 Q44,81 40,79 Z" stroke-width="1.2" stroke-linejoin="round"/>`;

/** Below 32 px: rim, face and the chain ring; `.coin-team` turns it Elbe blue. */
const MINI = `<circle class="c-rim" cx="12" cy="12" r="11"/><circle class="c-mini" cx="12" cy="12" r="9.2" stroke-width="1.2"/><circle class="c-line" cx="12" cy="12" r="5.6" stroke-width="1.1" stroke-dasharray="1.6 1.3"/>`;

/**
 * Markup, not `SafeHtml`: `html.ts` imports this module, so nothing here may
 * build a `SafeHtml` while the modules load.
 */
export const COIN_SPRITE = `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><symbol id="coin-front" viewBox="0 0 100 100">${FRONT}</symbol><symbol id="coin-back" viewBox="0 0 100 100">${BACK}</symbol><symbol id="coin-mini" viewBox="0 0 24 24">${MINI}</symbol></svg>`;

/** Where the coin sits; `style.ts` sizes each. */
export type CoinSize = "mark" | "head" | "hero" | "large";

/** One side of the coin, front for Training Rynke, back for Team Rynke. */
export function coin(side: "front" | "back", size: CoinSize): SafeHtml {
	return new SafeHtml(
		`<svg class="coin coin-${size}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#coin-${side}"/></svg>`,
	);
}

/** The mini coin of a kind of Rynke. */
export function miniCoin(kind: "training" | "team"): SafeHtml {
	const team = kind === "team" ? " coin-team" : "";
	return new SafeHtml(
		`<svg class="coin coin-mini${team}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#coin-mini"/></svg>`,
	);
}
