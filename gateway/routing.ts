// Which teams an event goes to (feature 046 research R2, R4). Pure, so it is
// tested without the object or the queue.

export const MODES = ["off", "trial", "on"] as const;
export type RoutingMode = (typeof MODES)[number];

/** A team routes while its last full list is at most this old (FR-007). */
export const LIST_MAX_AGE_SECONDS = 48 * 60 * 60;

/** The `ROUTING` setting; anything but `trial` or `on` is `off`. */
export function routingMode(raw: string | undefined): RoutingMode {
	return raw === "trial" || raw === "on" ? raw : "off";
}

/** Whether a team whose last list arrived at `listedAt` routes at `now`. */
export function isRouting(listedAt: number | undefined, now: number): boolean {
	return listedAt !== undefined && now - listedAt <= LIST_MAX_AGE_SECONDS;
}

export interface Choice {
	/** The teams to send the event to, in the order of `TEAMS`. */
	teams: string[];
	/** Whether the copy listed the athlete, or the event goes to everyone. */
	by: "copy" | "everyone";
	/**
	 * Whether every team was routing (FR-025's 1% rule). An unreadable copy
	 * counts as routing, so it raises the share rather than hide it.
	 */
	allRouting: boolean;
}

/**
 * FR-001: the teams the copy lists for the athlete, plus every team that isn't
 * routing; every team when the copy lists none of `all`, or when it couldn't be
 * read (`listed` null).
 */
export function chooseTeams(
	all: readonly string[],
	listed: readonly string[] | null,
	routing: readonly string[] | null,
): Choice {
	if (listed === null || routing === null) {
		return { teams: [...all], by: "everyone", allRouting: true };
	}
	const allRouting = all.every((team) => routing.includes(team));
	if (!all.some((team) => listed.includes(team))) {
		return { teams: [...all], by: "everyone", allRouting };
	}
	return {
		teams: all.filter(
			(team) => listed.includes(team) || !routing.includes(team),
		),
		by: "copy",
		allRouting,
	};
}
