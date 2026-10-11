import type { RiderStatus } from "../rynke/pace";
import { html, type SafeHtml } from "./html";

// Rynke on a bike, one illustration per rider status (issue #93), traced by
// `pnpm illustrations` into `public/illustrations/` and served by the app
// itself (feature 012 FR-005). Decorative: the label or sentence next to it
// says the status in words (FR-004).

const FILE: Record<RiderStatus, string> = {
	push: "status_push_fun",
	on_track: "status_on_track_fun",
	in: "status_in_fun",
};

/** The pixel size each place draws it at, so the layout doesn't jump. */
const SIZE = { chip: 20, tile: 48, banner: 96 } as const;

export type StatusArtSize = keyof typeof SIZE;

export function statusArt(status: RiderStatus, size: StatusArtSize): SafeHtml {
	const px = SIZE[size];
	return html`<img class="status-art status-art-${size}" src="/illustrations/${FILE[status]}.svg" alt="" width="${px}" height="${px}">`;
}
