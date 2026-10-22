import { SafeHtml } from "./html";

// The fun themes' small decorations (feature 022 US3,
// contracts/fun-decorations.md): hidden for screen readers, never in the way
// of a tap, and shown only by the stylesheet in Konfetti and Disco.

/** Four stars twinkling round a hero card's coin. */
export const FUN_SPARKLES = new SafeHtml(
	'<span class="fun-sparkles" aria-hidden="true"><span></span><span></span><span></span><span></span></span>',
);

/** Four confetti strips falling behind the qualified card's text. */
export const FUN_BURSTS = new SafeHtml(
	'<span class="fun-bursts" aria-hidden="true"><span></span><span></span><span></span><span></span></span>',
);
