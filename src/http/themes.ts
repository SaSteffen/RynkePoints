// The twelve colour themes of the header's theme menu (feature 022
// data-model.md "Theme", contracts/themes.md), in menu order. The stylesheet's
// `:root[data-theme=<id>]` rules, the head script's id → [scheme, surface]
// table, the menu's tiles and the contrast test all read this list. Rynke Tag
// and Rynke Nacht are the base light and dark token sets, so they override
// nothing.

export type ThemeId =
	| "rynke-day"
	| "baltic"
	| "paris"
	| "lilac"
	| "confetti"
	| "rynke-night"
	| "night-ride"
	| "forest"
	| "plum"
	| "disco"
	| "contrast-light"
	| "contrast-dark";

export type ThemeGroup = "light" | "dark" | "contrast";

/** The colours of a theme's tile in the menu: the theme itself, not the current one. */
export interface ThemePreview {
	bg: string;
	hero: string;
	pc: string;
	primary: string;
	card: string;
	text: string;
}

export interface Theme {
	id: ThemeId;
	group: ThemeGroup;
	/** Sets `data-scheme`, the Strava images' variant and `color-scheme`. */
	scheme: "light" | "dark";
	/** Decorations and the page-switch show (feature 022 US3, US4). */
	fun: "confetti" | "disco" | null;
	/** Overrides of the base scheme's tokens. */
	tokens: Record<string, string>;
	preview: ThemePreview;
}

/** The canvas's roles of one theme (contracts/themes.md "Canvas roles → tokens"). */
interface Roles {
	bg: string;
	low: string;
	card: string;
	/** `surface-container-high`, the menu panel: a step from `card` toward `text`. */
	high: string;
	text: string;
	muted: string;
	outline: string;
	outlineVar: string;
	primary: string;
	onPrimary: string;
	primaryText: string;
	pc: string;
	onPc: string;
	hero: string;
	heroText: string;
	heroLabel: string;
	heroAccent: string;
	track: string;
	/** The gauge's fill; the fun themes' rainbow comes on top (fun-decorations.md). */
	fill: string;
}

const md = (role: string) => `--md-sys-color-${role}`;

function tokens(r: Roles, more: Record<string, string> = {}) {
	return {
		[md("surface")]: r.bg,
		[md("surface-container-low")]: r.low,
		[md("surface-container")]: r.card,
		[md("surface-container-high")]: r.high,
		[md("on-surface")]: r.text,
		[md("on-surface-variant")]: r.muted,
		[md("outline")]: r.outline,
		[md("outline-variant")]: r.outlineVar,
		[md("primary")]: r.primary,
		[md("on-primary")]: r.onPrimary,
		"--rp-primary-text": r.primaryText,
		[md("primary-container")]: r.pc,
		[md("on-primary-container")]: r.onPc,
		[md("secondary-container")]: r.pc,
		[md("on-secondary-container")]: r.onPc,
		"--rp-hero": r.hero,
		"--rp-on-hero": r.heroText,
		"--rp-hero-label": r.heroLabel,
		"--rp-hero-accent": r.heroAccent,
		"--rp-track": r.track,
		"--rp-reached": r.fill,
		...more,
	};
}

function theme(
	id: ThemeId,
	group: ThemeGroup,
	scheme: "light" | "dark",
	r: Roles,
	more: Record<string, string> = {},
): Theme {
	return {
		id,
		group,
		scheme,
		fun: id === "confetti" ? "confetti" : id === "disco" ? "disco" : null,
		tokens: tokens(r, more),
		preview: {
			bg: r.bg,
			hero: r.hero,
			pc: r.pc,
			primary: r.primary,
			card: r.card,
			text: r.text,
		},
	};
}

/** The high-contrast themes' extra roles (contracts/themes.md "Contrast themes"). */
const contrast = (light: boolean): Record<string, string> => ({
	"--rp-outline-width": "2px",
	"--rp-selected-edge": "var(--md-sys-color-outline)",
	"--rp-ok-container": light ? "#ffffff" : "#000000",
	"--rp-on-ok-container": light ? "#0a5c26" : "#7dff9a",
	[md("error")]: light ? "#b00000" : "#ff8a80",
	[md("error-container")]: light ? "#ffffff" : "#000000",
	[md("on-error-container")]: light ? "#b00000" : "#ff8a80",
	"--rp-neutral-container": light ? "#ffffff" : "#000000",
	"--rp-on-neutral-container": light ? "#000000" : "#ffffff",
});

export const THEMES: readonly Theme[] = [
	{
		id: "rynke-day",
		group: "light",
		scheme: "light",
		fun: null,
		tokens: {},
		preview: {
			bg: "#fffdf5",
			hero: "#24221a",
			pc: "#fbe122",
			primary: "#1c1b13",
			card: "#f6f2e0",
			text: "#1c1b13",
		},
	},
	theme("baltic", "light", "light", {
		bg: "#f5fafb",
		low: "#eef6f8",
		card: "#e3eff3",
		high: "#d8e4e9",
		text: "#0e1d24",
		muted: "#3b525c",
		outline: "#6b828c",
		outlineVar: "#c3d5dc",
		primary: "#0b5874",
		onPrimary: "#ffffff",
		primaryText: "#0b5874",
		pc: "#ffd45c",
		onPc: "#2a1f00",
		hero: "#0b3a4d",
		heroText: "#f5fafb",
		heroLabel: "#bfe0ea",
		heroAccent: "#ffd45c",
		track: "#c3d5dc",
		fill: "#0b8fb3",
	}),
	theme("paris", "light", "light", {
		bg: "#fff8f7",
		low: "#fcf0ef",
		card: "#f8e6e6",
		high: "#eedcdc",
		text: "#26181a",
		muted: "#5a3f43",
		outline: "#87696d",
		outlineVar: "#e0c4c7",
		primary: "#7a1d3b",
		onPrimary: "#ffffff",
		primaryText: "#7a1d3b",
		pc: "#ffd9df",
		onPc: "#3e0018",
		hero: "#3a1420",
		heroText: "#fff8f7",
		heroLabel: "#f2c6cf",
		heroAccent: "#ffb3c2",
		track: "#e0c4c7",
		fill: "#b0365c",
	}),
	theme("lilac", "light", "light", {
		bg: "#fcf8ff",
		low: "#f7f1fd",
		card: "#f0e7fa",
		high: "#e6dcf0",
		text: "#1e1528",
		muted: "#4d3f5c",
		outline: "#7c6c8c",
		outlineVar: "#d8cbe6",
		primary: "#5e3a8c",
		onPrimary: "#ffffff",
		primaryText: "#5e3a8c",
		pc: "#e6d4ff",
		onPc: "#240a45",
		hero: "#2c1a42",
		heroText: "#fcf8ff",
		heroLabel: "#dccbf2",
		heroAccent: "#fbe122",
		track: "#d8cbe6",
		fill: "#7d52b8",
	}),
	theme("confetti", "light", "light", {
		bg: "#fffcf7",
		low: "#fff4fa",
		card: "#f7efff",
		high: "#ece4f5",
		text: "#23163a",
		muted: "#54467a",
		outline: "#7d6fa6",
		outlineVar: "#ddd1f5",
		primary: "#5a22d6",
		onPrimary: "#ffffff",
		primaryText: "#5a22d6",
		pc: "#ffe61a",
		onPc: "#2b1d00",
		hero: "#2b1460",
		heroText: "#fffcf7",
		heroLabel: "#dccfff",
		heroAccent: "#ffe61a",
		track: "#ece4fb",
		fill: "#5a22d6",
	}),
	{
		id: "rynke-night",
		group: "dark",
		scheme: "dark",
		fun: null,
		tokens: {},
		preview: {
			bg: "#12110c",
			hero: "#24221a",
			pc: "#fbe122",
			primary: "#fbe122",
			card: "#201f18",
			text: "#eeebdd",
		},
	},
	theme("night-ride", "dark", "dark", {
		bg: "#0e131c",
		low: "#141a25",
		card: "#19212e",
		high: "#232b38",
		text: "#e6ecf5",
		muted: "#b7c3d4",
		outline: "#7f8ca0",
		outlineVar: "#364256",
		primary: "#8cc4f0",
		onPrimary: "#08243a",
		primaryText: "#8cc4f0",
		pc: "#8cc4f0",
		onPc: "#08243a",
		hero: "#1b2a3e",
		heroText: "#e6ecf5",
		heroLabel: "#b7c3d4",
		heroAccent: "#fbe122",
		track: "#2a3446",
		fill: "#8cc4f0",
	}),
	theme("forest", "dark", "dark", {
		bg: "#0f1612",
		low: "#151e19",
		card: "#1a251f",
		high: "#242f29",
		text: "#e3eee6",
		muted: "#b7c9bd",
		outline: "#82978a",
		outlineVar: "#344238",
		primary: "#7fcb92",
		onPrimary: "#0a2614",
		primaryText: "#7fcb92",
		pc: "#7fcb92",
		onPc: "#0a2614",
		hero: "#1d2c22",
		heroText: "#e3eee6",
		heroLabel: "#bfe3c6",
		heroAccent: "#fbe122",
		track: "#2c3a31",
		fill: "#7fcb92",
	}),
	theme("plum", "dark", "dark", {
		bg: "#140e19",
		low: "#1b1421",
		card: "#211928",
		high: "#2b2332",
		text: "#efe6f5",
		muted: "#cdbfd8",
		outline: "#9a8aa8",
		outlineVar: "#43354f",
		primary: "#d7a6ec",
		onPrimary: "#2e0a3d",
		primaryText: "#d7a6ec",
		pc: "#d7a6ec",
		onPc: "#2e0a3d",
		hero: "#2a1a36",
		heroText: "#efe6f5",
		heroLabel: "#d8c6e6",
		heroAccent: "#fbe122",
		track: "#33283d",
		fill: "#d7a6ec",
	}),
	theme("disco", "dark", "dark", {
		bg: "#120a22",
		low: "#180f2c",
		card: "#1f1436",
		high: "#2a1f40",
		text: "#f4ecff",
		muted: "#cdbde8",
		outline: "#9a88bf",
		outlineVar: "#3f2d62",
		primary: "#ff5cb8",
		onPrimary: "#2a0018",
		primaryText: "#ff8fd1",
		pc: "#ff5cb8",
		onPc: "#2a0018",
		hero: "#24124a",
		heroText: "#f4ecff",
		heroLabel: "#d8c8f5",
		heroAccent: "#ffe61a",
		track: "#2f2150",
		fill: "#ff5cb8",
	}),
	theme(
		"contrast-light",
		"contrast",
		"light",
		{
			bg: "#ffffff",
			low: "#ffffff",
			card: "#ffffff",
			high: "#ffffff",
			text: "#000000",
			muted: "#1a1a1a",
			outline: "#000000",
			outlineVar: "#000000",
			primary: "#000000",
			onPrimary: "#ffffff",
			primaryText: "#000000",
			pc: "#ffe600",
			onPc: "#000000",
			hero: "#000000",
			heroText: "#ffffff",
			heroLabel: "#ffffff",
			heroAccent: "#ffe600",
			track: "#ffffff",
			fill: "#000000",
		},
		contrast(true),
	),
	theme(
		"contrast-dark",
		"contrast",
		"dark",
		{
			bg: "#000000",
			low: "#000000",
			card: "#000000",
			high: "#000000",
			text: "#ffffff",
			muted: "#f2f2f2",
			outline: "#ffffff",
			outlineVar: "#ffffff",
			primary: "#ffe600",
			onPrimary: "#000000",
			primaryText: "#ffe600",
			pc: "#ffe600",
			onPc: "#000000",
			hero: "#000000",
			heroText: "#ffffff",
			heroLabel: "#ffffff",
			heroAccent: "#ffe600",
			track: "#000000",
			fill: "#ffe600",
		},
		contrast(false),
	),
];

/** The menu's groups, in order. */
export const THEME_GROUPS: readonly ThemeGroup[] = [
	"light",
	"dark",
	"contrast",
];
