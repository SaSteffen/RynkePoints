import { returnVia, verifyToken } from "../config";
import type { Ctx } from "../ctx";
import { riderHold } from "../db/riders";
import {
	listHeldAthleteIds,
	ownRoutingCounts,
	upsertRoutingCountStatement,
} from "../db/routing";
import {
	FIGURES,
	firstRoutingDay,
	isCount,
	isFigureOf,
	isRoutingDay,
	type RoutingCount,
	routingDay,
	TEAM_FIGURES,
} from "./figures";

// What a team tells the gateway for routing (feature 046
// contracts/team-side.md): a report after it stores or deletes a person, its
// full list once a day, and its counts every hour. Only with a gateway. IDs go
// as strings (research R8). Bodies and the token are never logged.

type GatewayCtx = Pick<Ctx, "env" | "team">;

const GATEWAY_TIMEOUT_MS = 10_000;
const TEAM = /^[a-z][a-z0-9-]{0,30}$/;

/** POSTs `body` to the gateway's `/teams/<id>/<what>`; null on a network error. */
async function postGateway(
	ctx: GatewayCtx,
	what: "report" | "list" | "counts",
	body: unknown,
): Promise<Response | null> {
	const gateway = returnVia(ctx.env);
	if (gateway === null) return null;
	try {
		return await fetch(new URL(`/teams/${ctx.team.id}/${what}`, gateway), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${verifyToken(ctx.env)}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
			redirect: "manual",
		});
	} catch {
		return null;
	}
}

/** Whether an answer settles a report or list: taken, or not taken at all. */
const settled = (res: Response | null) =>
	res !== null && (res.ok || res.status === 404);

/**
 * Queues a report about the person, after this team stored or deleted them
 * (FR-004). Never throws: a report that can't be queued is logged, and the
 * next full list corrects the copy (FR-005).
 */
export async function queueReport(
	ctx: Pick<Ctx, "env" | "queue">,
	athleteId: string,
): Promise<void> {
	if (returnVia(ctx.env) === null) return;
	try {
		await ctx.queue.send({ kind: "report-hold", athleteId });
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`report-hold for athlete ${athleteId} not queued: ${name}`);
	}
}

/**
 * Tells the gateway whether this team holds the person now, so reports can't
 * overtake each other. `done` once the gateway took it or takes no reports.
 */
export async function sendReport(
	ctx: GatewayCtx,
	athleteId: string,
): Promise<"done" | "retry"> {
	if (returnVia(ctx.env) === null) return "done";
	const { held } = await riderHold(ctx.env.DB, athleteId);
	const res = await postGateway(ctx, "report", {
		athleteId,
		held: held !== "none",
	});
	await res?.body?.cancel();
	return settled(res) ? "done" : "retry";
}

/**
 * The daily full list (FR-006): every person the team holds. Throws when the
 * gateway didn't take it, so the run shows the failure.
 */
export async function sendFullList(ctx: GatewayCtx): Promise<void> {
	if (returnVia(ctx.env) === null) return;
	const athleteIds = await listHeldAthleteIds(ctx.env.DB);
	const res = await postGateway(ctx, "list", { athleteIds });
	await res?.body?.cancel();
	if (!settled(res)) {
		throw new Error(
			`Full list not taken: ${res === null ? "network error" : `HTTP ${res.status}`}`,
		);
	}
}

/** The gateway's answer to an exchange, or null when it isn't one. */
export function parseExchange(
	body: unknown,
	today: string,
): RoutingCount[] | null {
	const days = (body as { days?: unknown } | null)?.days;
	if (!Array.isArray(days)) return null;
	const counts: RoutingCount[] = [];
	for (const entry of days) {
		const { day, team, figure, count } = (entry ?? {}) as Record<
			string,
			unknown
		>;
		if (
			!isRoutingDay(day, today) ||
			typeof team !== "string" ||
			(team !== "" && !TEAM.test(team)) ||
			!isFigureOf(FIGURES, figure) ||
			!isCount(count)
		) {
			return null;
		}
		counts.push({ day, team, figure, count });
	}
	return counts;
}

/**
 * The hourly exchange (research R9): hands this team's own counts to the
 * gateway and stores every count it answers with, but this team's own, which
 * are counted here. A failure keeps what is stored.
 */
export async function exchangeRoutingCounts(ctx: Ctx): Promise<void> {
	if (returnVia(ctx.env) === null) return;
	const db = ctx.env.DB;
	const today = routingDay(ctx.now());
	const own = await ownRoutingCounts(db, ctx.team.id, firstRoutingDay(today));
	const res = await postGateway(ctx, "counts", { days: own });
	if (res === null || !res.ok) {
		await res?.body?.cancel();
		console.warn(
			`Routing counts unavailable: ${res === null ? "network error" : `HTTP ${res.status}`}`,
		);
		return;
	}
	let counts: RoutingCount[] | null;
	try {
		counts = parseExchange(await res.json(), today);
	} catch {
		counts = null;
	}
	if (counts === null) {
		console.warn("Routing counts unavailable: unexpected response");
		return;
	}
	const theirs = counts.filter(
		(c) => !(c.team === ctx.team.id && isFigureOf(TEAM_FIGURES, c.figure)),
	);
	if (theirs.length > 0) {
		await db.batch(theirs.map((c) => upsertRoutingCountStatement(db, c)));
	}
}
