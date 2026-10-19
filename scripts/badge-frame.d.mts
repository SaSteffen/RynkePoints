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
	tail: {
		inner: number;
		outer: number;
		notch: number;
		top: number;
		bottom: number;
	};
};

/** The ribbon's shapes as they lie over a badge; the page draws them. */
export function ribbonSvg(kind: BadgeGroup): string;

/** The finished badge SVG, without the ribbon. */
export function frameSvg(
	kind: BadgeGroup,
	picture: string,
	title: string,
	options?: { transform?: string },
): string;

/** The frame with the coin's Rynke, shown until a badge has a picture. */
export function placeholderSvg(kind: BadgeGroup): string;
