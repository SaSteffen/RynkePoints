import type { Ctx } from "../ctx";
import { addRoutingCountStatement } from "../db/routing";
import type { EventRoute } from "../work/messages";
import { routingDay, type TeamFigure } from "./figures";

// This team's own routing counts (feature 046 contracts/team-side.md › Event
// counts, Re-check finds): counts only, by UTC day. A failure to count is
// logged and never changes what happens to the event.

/**
 * Counts one webhook event at the rider check: dropped when this team doesn't
 * hold the athlete, and in the trial a would-be wasted delivery or a
 * would-be miss (FR-020, FR-021).
 */
export async function countEvent(
	ctx: Pick<Ctx, "env" | "now" | "team">,
	route: EventRoute,
	held: boolean,
): Promise<void> {
	const figures: TeamFigure[] = held
		? route === "not-chosen"
			? ["missed"]
			: []
		: route === "chosen"
			? ["dropped", "wasted"]
			: ["dropped"];
	await addCounts(
		ctx,
		figures.map((figure) => [figure, 1]),
	);
}

/** Counts activities the ride re-check stored that weren't stored (FR-023). */
export async function countFound(
	ctx: Pick<Ctx, "env" | "now" | "team">,
	n: number,
): Promise<void> {
	if (n > 0) await addCounts(ctx, [["found", n]]);
}

async function addCounts(
	ctx: Pick<Ctx, "env" | "now" | "team">,
	counts: [TeamFigure, number][],
): Promise<void> {
	if (counts.length === 0) return;
	const db = ctx.env.DB;
	const day = routingDay(ctx.now());
	try {
		await db.batch(
			counts.map(([figure, n]) =>
				addRoutingCountStatement(db, day, ctx.team.id, figure, n),
			),
		);
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`Routing count failed: ${name}`);
	}
}
