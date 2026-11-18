import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { seasonStart, seasonStartEpoch } from "../../src/config";
import type { Rider } from "../../src/db/riders";
import { countingWindow, seasonEnd } from "../../src/rynke/rules";
import { teamFor } from "../../src/teams";
import { keptActivities } from "../../src/work/activity-page";
import { makeCtx } from "../support/ctx";
import { ATHLETE_A, makeStravaActivity } from "../support/fixtures";

// Every team's season runs 1 September to 31 August (feature 040 US2, FR-005 to
// FR-007): rides are fetched and kept from the season start, whatever day the
// qualification window opens, and the season ends the day before the next
// 1 September.

const team = teamFor(env);
const window = countingWindow(env);
const rider = { athleteId: ATHLETE_A, scopeReadAll: true } as Rider;

describe(`${team.id}'s season (040 US2)`, () => {
	it("starts on 1 September 2026", () => {
		expect(window.seasonStart).toBe("2026-09-01");
		expect(seasonStart(env)).toBe(seasonStartEpoch("2026-09-01"));
	});

	it("ends on 31 August 2027", () => {
		expect(seasonEnd(window)).toBe("2027-08-31");
	});

	it("keeps the season's rides from 1 September on, none before", () => {
		const ride = (startDate: string) =>
			makeStravaActivity({
				start_date: `${startDate}T06:00:00Z`,
				start_date_local: `${startDate}T08:00:00Z`,
			});
		const kept = keptActivities(
			[ride("2026-08-31"), ride("2026-09-01"), ride("2026-11-18")],
			rider,
			makeCtx({ now: Date.UTC(2026, 10, 18, 12) / 1000 }),
		);
		expect(kept.records.map((r) => r.start_date.slice(0, 10))).toEqual([
			"2026-09-01",
			"2026-11-18",
		]);
	});
});

describe.runIf(team.id === "europe")("europe's window (040 US2)", () => {
	it("opens on 1 January 2027, after the season start", () => {
		expect(window.windowStart).toBe("2027-01-01");
		expect(window.deadline).toBe("2027-06-30");
	});
});
