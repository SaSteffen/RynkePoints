// Gateway routing's figures (feature 046 data-model.md), shared by the gateway
// and the teams: counts per UTC day, never an athlete, activity or name
// (FR-026). Self-contained, since the gateway imports it.

/** Counted by the gateway for each event, for every team together (team ""). */
export const GATEWAY_FIGURES = [
	"copy",
	"everyone",
	"allRouting",
	"allRoutingEveryone",
] as const;

/** Counted by the gateway for each team's full list. */
export const LIST_FIGURES = ["added", "removed", "possible"] as const;

/** Counted by each team itself, and handed to the gateway hourly. */
export const TEAM_FIGURES = ["missed", "wasted", "dropped", "found"] as const;

export const FIGURES = [
	...GATEWAY_FIGURES,
	...LIST_FIGURES,
	...TEAM_FIGURES,
] as const;

export type GatewayFigure = (typeof GATEWAY_FIGURES)[number];
export type ListFigure = (typeof LIST_FIGURES)[number];
export type TeamFigure = (typeof TEAM_FIGURES)[number];
export type Figure = (typeof FIGURES)[number];

/** One count. `team` is "" for the gateway's own figures. */
export interface RoutingCount {
	day: string;
	team: string;
	figure: Figure;
	count: number;
}

/** How many days the counts are kept and shown, today included (FR-024, FR-026). */
export const ROUTING_DAYS = 30;

/** The trial's mark on a forwarded event (research R5). */
export const ROUTE_HEADER = "X-Rynke-Route";
export const ROUTE_MARKS = ["chosen", "not-chosen"] as const;
export type RouteMark = (typeof ROUTE_MARKS)[number];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The UTC day of an epoch time in seconds. */
export function routingDay(epochSeconds: number): string {
	return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

/** The oldest day still kept and shown. */
export function firstRoutingDay(today: string): string {
	const date = new Date(`${today}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - (ROUTING_DAYS - 1));
	return date.toISOString().slice(0, 10);
}

/** A `YYYY-MM-DD` day from `first` to `today`. */
export function isRoutingDay(value: unknown, today: string): value is string {
	return (
		typeof value === "string" &&
		DAY.test(value) &&
		!Number.isNaN(Date.parse(value)) &&
		value >= firstRoutingDay(today) &&
		value <= today
	);
}

export function isFigureOf<T extends string>(
	figures: readonly T[],
	value: unknown,
): value is T {
	return (
		typeof value === "string" && (figures as readonly string[]).includes(value)
	);
}

/** A count: a whole number from zero. */
export function isCount(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}
