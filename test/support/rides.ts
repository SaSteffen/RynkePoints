// Synthetic rides in human units for the evaluation tests (constitution
// Principle I). Nothing here describes a real ride.

import type { Ride } from "../../src/rynke/rides";
import type { CountingWindow } from "../../src/rynke/rules";

export interface RideSpec {
	id: number;
	km: number;
	movingH: number;
	pausedH?: number;
	elevationM?: number;
	/** UTC start; also the local start unless `startLocal` is given. */
	start?: string;
	startLocal?: string;
	sportType?: string;
	manual?: boolean | null;
	trainer?: boolean | null;
	flagged?: boolean | null;
	elapsedUnknown?: boolean;
}

export const WINDOW: CountingWindow = {
	seasonStart: "2026-01-01",
	deadline: "2027-06-30",
};

export function makeRide(spec: RideSpec): Ride {
	const movingS = Math.round(spec.movingH * 3600);
	const start = spec.start ?? "2026-05-01T08:00:00Z";
	return {
		activityId: spec.id,
		sportType: spec.sportType ?? "Ride",
		startUtc: start,
		startLocal: spec.startLocal ?? start,
		distanceM: spec.km * 1000,
		movingS,
		elapsedS: spec.elapsedUnknown
			? null
			: movingS + Math.round((spec.pausedH ?? 0) * 3600),
		elevationM: spec.elevationM ?? 0,
		manual: spec.manual === undefined ? false : spec.manual,
		trainer: spec.trainer === undefined ? false : spec.trainer,
		flagged: spec.flagged === undefined ? false : spec.flagged,
		refreshedAt: 0,
	};
}
