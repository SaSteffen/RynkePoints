import { env } from "cloudflare:test";
import { upsertActivities } from "../../src/db/activities";
import {
	upsertBalanceStatement,
	upsertRideResultsStatement,
} from "../../src/db/rynke";
import { handleFetch } from "../../src/index";
import type { ReasonCode, UnknownFigureCode } from "../../src/rynke/rides";
import { CURRENT_RULES } from "../../src/rynke/rules";
import { type Balance, NO_EXTRAS } from "../../src/rynke/tally";
import type { ActivityRecord } from "../../src/strava/activity";
import { request, sessionCookie, type TestCtx } from "./ctx";
import { NOW } from "./fixtures";
import { activityRecord } from "./rynke";

// Stored Rynke rows for the rider page (feature 005), written straight to D1.
// The page only reads them, so they needn't come from an evaluation. Synthetic
// values only (constitution Principle I).

/** A consistent zero balance under the current rules. */
export const ZERO_BALANCE: Balance = {
	distanceRynke: 0,
	elevationDm: 0,
	elevationRynke: 0,
	elevationToNextStepDm: 10000,
	trainingRynke: 0,
	teamRynke: 0,
	trainingMissing: 250,
	teamMissing: 25,
	trainingWithoutVirtual: 0,
	virtualShareMissing: 167,
	qualified: false,
	rulesVersion: CURRENT_RULES.version,
	rulesEffectiveDate: CURRENT_RULES.effectiveDate,
	teamEvents: [...NO_EXTRAS.teamEvents],
};

export async function seedBalance(
	athleteId: number,
	overrides: Partial<Balance> = {},
): Promise<void> {
	await upsertBalanceStatement(
		env.DB,
		athleteId,
		{ ...ZERO_BALANCE, ...overrides },
		NOW,
	).run();
}

export interface SeedResult {
	counts: boolean;
	reasons?: ReasonCode[];
	overlapsActivityId?: number | null;
	distanceRynke?: number;
	elevationDm?: number;
	isVirtual?: boolean;
	unknownFigures?: UnknownFigureCode[];
	rulesVersion?: number;
}

export interface SeedRide extends Partial<ActivityRecord> {
	id: number;
	/** Absent = no `ride_results` row: the ride is being evaluated. */
	result?: SeedResult;
}

/** One activity, plus its result when `ride.result` is given. */
export async function seedRide(
	athleteId: number,
	{ id, result, ...activity }: SeedRide,
): Promise<void> {
	const record = activityRecord(id, { ...activity, athlete_id: athleteId });
	await upsertActivities(env.DB, [record]);
	if (!result) return;
	await upsertRideResultsStatement(env.DB, athleteId, [
		{
			activityId: id,
			counts: result.counts,
			reasons: result.reasons ?? [],
			overlapsActivityId: result.overlapsActivityId ?? null,
			distanceRynke: result.distanceRynke ?? 0,
			elevationDm: result.elevationDm ?? 0,
			isVirtual: result.isVirtual ?? false,
			unknownFigures: result.unknownFigures ?? [],
			activityRefreshedAt: record.refreshed_at,
			rulesVersion: result.rulesVersion ?? CURRENT_RULES.version,
		},
	]).run();
}

/**
 * `n` counting 40 km rides with ids `firstId` …, one a day going back from
 * `start` (`YYYY-MM-DD`), newest first.
 */
export async function seedRides(
	athleteId: number,
	n: number,
	start: string,
	firstId = 8_000_001,
): Promise<void> {
	const day = Date.parse(`${start}T08:00:00Z`);
	const records: ActivityRecord[] = [];
	const results = [];
	for (let i = 0; i < n; i++) {
		const startDate = new Date(day - i * 86_400_000)
			.toISOString()
			.replace(".000Z", "Z");
		const record = activityRecord(firstId + i, {
			athlete_id: athleteId,
			start_date: startDate,
		});
		records.push(record);
		results.push({
			activityId: record.strava_activity_id,
			counts: true,
			reasons: [],
			overlapsActivityId: null,
			distanceRynke: 4,
			elevationDm: 3000,
			isVirtual: false,
			unknownFigures: [],
			activityRefreshedAt: record.refreshed_at,
			rulesVersion: CURRENT_RULES.version,
		});
	}
	await upsertActivities(env.DB, records);
	await upsertRideResultsStatement(env.DB, athleteId, results).run();
}

/** `GET path` as the signed-in rider. */
export async function riderPage(
	ctx: TestCtx,
	athleteId: number,
	path = "/me",
	acceptLanguage?: string,
): Promise<{ status: number; html: string }> {
	const response = await handleFetch(
		request(path, {
			acceptLanguage,
			cookies: await sessionCookie(ctx, athleteId),
		}),
		ctx,
	);
	return { status: response.status, html: await response.text() };
}

/** The tags-stripped, whitespace-collapsed text of an HTML fragment. */
function plain(fragment: string): string {
	return fragment
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** One ride card of `ol.ride-list` (feature 011 contracts/pages.md "Rides"). */
export interface RideCard {
	/** `ride-counting`, `ride-not-counting` or `ride-pending`. */
	status: string;
	/** Date, distance, chip, Training Rynke, elevation: 005's old column order. */
	cells: string[];
	/** The `dt` labels of `dl.ride-figures`. */
	labels: string[];
	/** The `p.ride-meta` text: sport, gain and "virtual". */
	meta: string;
	/** `details.ride-why`'s HTML, `null` without one. */
	why: string | null;
	/** Whether `details.ride-why` is rendered `open`. */
	open: boolean;
	/** The card's inner HTML. */
	html: string;
}

/** The ride cards of a page, in order. */
export function rideCards(page: string): RideCard[] {
	return [
		...page.matchAll(
			/<li class="ride-card ([^"]*)">([\s\S]*?)<\/li>\n(?=<li class="ride-card|<\/ol>)/g,
		),
	].map(([, status = "", inner = ""]) => {
		const pick = (re: RegExp) => plain(inner.match(re)?.[1] ?? "");
		const figures = [...inner.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map((m) =>
			plain(m[1] ?? ""),
		);
		const why = inner.match(
			/<details class="ride-why"[^>]*>[\s\S]*?<\/details>/,
		);
		return {
			status,
			cells: [
				pick(/<span class="ride-date">([\s\S]*?)<\/span>/),
				figures[0] ?? "",
				pick(/<span class="chip ride-status">([\s\S]*?)<\/span>/),
				figures[1] ?? "",
				figures[2] ?? "",
			],
			labels: [...inner.matchAll(/<dt>([\s\S]*?)<\/dt>/g)].map((m) =>
				plain(m[1] ?? ""),
			),
			meta: pick(/<p class="ride-meta">([\s\S]*?)<\/p>/),
			why: why?.[0] ?? null,
			open: /^<details class="ride-why" open>/.test(why?.[0] ?? ""),
			html: inner,
		};
	});
}
