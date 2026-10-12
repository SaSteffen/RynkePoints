import { BADGE_CATALOG_VERSION } from "../badges/catalog";
import { seasonStart } from "../config";
import type { Ctx } from "../ctx";
import { listPreSeasonActivities } from "../db/pre-season";
import {
	deleteFailedWorkFirstFailedBefore,
	listFailedWorkFirstFailedSince,
} from "../db/failed-work";
import {
	listConnectedRiderIds,
	listExpiredReconnectRiderIds,
	listRidersBehindFiguresVersion,
	setFiguresVersion,
} from "../db/riders";
import { listRidersNeedingEvaluation } from "../db/rynke";
import { evaluateChange } from "../rynke/apply";
import { CURRENT_RULES, countingWindow } from "../rynke/rules";
import { ACTIVITY_FIGURES_VERSION } from "../strava/activity";
import { parseWorkMessage, sendAll, type WorkMessage } from "./messages";

// Daily cron work (contracts/queue-messages.md, "Scheduled").

const GIVE_UP_AFTER_SECONDS = 7 * 24 * 3600;
const RECONNECT_GRACE_SECONDS = 7 * 24 * 3600;

/** One `check-membership` per connected rider (FR-004a). */
export async function fanOutMembershipChecks(ctx: Ctx): Promise<void> {
	const ids = await listConnectedRiderIds(ctx.env.DB);
	await sendAll(
		ctx,
		ids.map((athleteId) => ({ kind: "check-membership", athleteId })),
	);
}

/** Deletes riders still `needs_reconnect` after 7 days (FR-020). */
export async function expireReconnectRiders(ctx: Ctx): Promise<void> {
	const ids = await listExpiredReconnectRiderIds(
		ctx.env.DB,
		ctx.now() - RECONNECT_GRACE_SECONDS,
	);
	await sendAll(
		ctx,
		ids.map((athleteId) => ({
			kind: "delete-rider",
			athleteId,
			reason: "reconnect-expired",
			revoke: true,
		})),
	);
}

/**
 * Gives up failures first seen more than 7 days ago and re-enqueues the rest
 * (R7, FR-019). Re-enqueued rows stay until their message succeeds.
 */
export async function requeueFailedWork(ctx: Ctx): Promise<void> {
	const cutoff = ctx.now() - GIVE_UP_AFTER_SECONDS;
	const givenUp = await deleteFailedWorkFirstFailedBefore(ctx.env.DB, cutoff);
	for (const row of givenUp) {
		// The message holds identifiers only, so it is safe to log.
		console.error(
			`Giving up failed work after 7 days (${row.failures} failures, last: ${row.lastError}): ${row.message}`,
		);
	}

	const retry: WorkMessage[] = [];
	for (const row of await listFailedWorkFirstFailedSince(ctx.env.DB, cutoff)) {
		const message = parseWorkMessage(safeParse(row.message));
		if (message) retry.push(message);
		else console.error(`Unreadable failed_work row ${row.id}; leaving it`);
	}
	await sendAll(ctx, retry);
}

/**
 * Re-reads, once, every connected rider whose activities were stored before
 * FR-013 gained a figure (R20). Sends before marking: if marking fails, the
 * next run sends again, which is harmless.
 */
export async function fanOutFiguresReread(ctx: Ctx): Promise<void> {
	const ids = await listRidersBehindFiguresVersion(
		ctx.env.DB,
		ACTIVITY_FIGURES_VERSION,
	);
	const after = seasonStart(ctx.env);
	for (const athleteId of ids) {
		await ctx.queue.send({ kind: "reread-page", athleteId, page: 1, after });
		await setFiguresVersion(ctx.env.DB, athleteId, ACTIVITY_FIGURES_VERSION);
	}
}

/**
 * Deletes every stored ride, run and swim that starts before the season
 * start, with the rider's Rynke: what was stored before nothing older could
 * be, and the last season's after the season start moves on. Such a ride never
 * counted, so the balance stays as it was.
 */
export async function purgePreSeasonActivities(ctx: Ctx): Promise<void> {
	const before = new Date(seasonStart(ctx.env) * 1000)
		.toISOString()
		.replace(".000Z", "Z");
	const byRider = await listPreSeasonActivities(ctx.env.DB, before);
	for (const [athleteId, activityIds] of byRider) {
		await evaluateChange(ctx, athleteId, { kind: "delete", activityIds });
	}
}

/**
 * One `evaluate-rider` per connected rider whose stored Rynke are missing or
 * stale: after the first deploy, a rules-version bump, a lost message, or
 * attendance entered by hand that the balance doesn't reflect yet (feature 003
 * research R14, R22), or a new badge catalog (feature 013 research R18).
 */
export async function fanOutEvaluations(ctx: Ctx): Promise<void> {
	const ids = await listRidersNeedingEvaluation(
		ctx.env.DB,
		CURRENT_RULES.version,
		countingWindow(ctx.env),
		BADGE_CATALOG_VERSION,
	);
	await sendAll(
		ctx,
		ids.map((athleteId) => ({ kind: "evaluate-rider", athleteId })),
	);
}

function safeParse(json: string): unknown {
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}

export async function handleScheduled(
	_controller: ScheduledController,
	ctx: Ctx,
): Promise<void> {
	// Independent steps, in contract order: one failing (D1, Queues) must not
	// skip the others, but the run still fails so it shows up in logs.
	let failure: unknown;
	let failed = false;
	for (const step of [
		fanOutMembershipChecks,
		expireReconnectRiders,
		requeueFailedWork,
		fanOutFiguresReread,
		purgePreSeasonActivities,
		fanOutEvaluations,
	]) {
		try {
			await step(ctx);
		} catch (err) {
			if (!failed) failure = err;
			failed = true;
		}
	}
	if (failed) throw failure;
}
