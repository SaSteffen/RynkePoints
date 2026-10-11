// Types for scripts/badge-frame.mjs, for the tests in test/unit/.

export type BadgeGroup = "personal" | "team";

/** The round window the picture shows through. */
export const WINDOW: { cx: number; cy: number; r: number };

/** Places a picture traced from the 2048 px canvas into the window. */
export const PICTURE_TRANSFORM: string;

/** The coin's Rynke, as in src/http/coin.ts. */
export const RYNKE: string;

/** Where the page puts the milestone on the ribbon, and in which colour. */
export const RIBBON: {
	box: { x: number; y: number; width: number; height: number };
	text: Record<BadgeGroup, string>;
};

/** The finished badge SVG, with the milestone ribbon when `ribbon` is set. */
export function frameSvg(
	kind: BadgeGroup,
	picture: string,
	title: string,
	options?: { transform?: string; ribbon?: boolean },
): string;

/** The frame with the coin's Rynke, shown until a badge has a picture. */
export function placeholderSvg(
	kind: BadgeGroup,
	options?: { ribbon?: boolean },
): string;
