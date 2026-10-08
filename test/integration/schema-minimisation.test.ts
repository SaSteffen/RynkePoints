import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// The stored columns are exactly those in data-model.md (FR-014, SC-007,
// FR-029a; feature 003 FR-015 for the Rynke tables). A new column means a
// data-model.md change and a reviewed update here, so nothing sensitive or a
// rider's language slips into D1 unnoticed.

const COLUMNS: Record<string, string[]> = {
	riders: [
		"athlete_id",
		"first_name",
		"status",
		"scope_read_all",
		"scope_write",
		"scopes",
		"connected_at",
		"scopes_updated_at",
		"membership_checked_at",
		"import_status",
		"reconnect_requested_at",
		"figures_version",
		"organiser",
	],
	activities: [
		"strava_activity_id",
		"athlete_id",
		"sport_type",
		"start_date",
		"start_date_local",
		"timezone",
		"distance_m",
		"moving_time_s",
		"elapsed_time_s",
		"elevation_gain_m",
		"is_manual",
		"is_trainer",
		"is_flagged",
		"is_private",
		"refreshed_at",
		"name",
	],
	consent_records: ["athlete_id", "version", "accepted_at"],
	ride_results: [
		"strava_activity_id",
		"athlete_id",
		"counts",
		"reasons",
		"overlaps_activity_id",
		"distance_rynke",
		"elevation_dm",
		"is_virtual",
		"unknown_figures",
		"rules_version",
		"activity_refreshed_at",
	],
	rynke_balances: [
		"athlete_id",
		"distance_rynke",
		"elevation_dm",
		"elevation_rynke",
		"elevation_to_next_step_dm",
		"training_rynke",
		"team_rynke",
		"training_missing",
		"team_missing",
		"training_without_virtual",
		"virtual_share_missing",
		"qualified",
		"rules_version",
		"rules_effective_date",
		"computed_at",
		"team_event_breakdown",
	],
	// Issue #45: the last rise, for the notification text.
	rynke_rises: ["athlete_id", "training_rynke", "team_rynke", "risen_at"],
	rynke_seen: ["athlete_id", "training_rynke", "team_rynke"],
	team_event_kinds: ["kind"],
	// Feature 014: the change record of each organiser input (research R9).
	team_events: [
		"event_id",
		"kind",
		"event_date",
		"name",
		"changed_by",
		"changed_at",
	],
	attendances: ["event_id", "athlete_id", "changed_by", "changed_at"],
	corrections: [
		"correction_id",
		"athlete_id",
		"training",
		"team",
		"reason",
		"correction_date",
		"changed_by",
		"changed_at",
	],
	// Feature 010: a device's push endpoint, nothing else (research R7).
	push_subscriptions: [
		"subscription_id",
		"endpoint",
		"athlete_id",
		"created_at",
	],
};

const FORBIDDEN = [
	"polyline",
	"latlng",
	"name",
	"title",
	"photo",
	"heartrate",
	"watts",
	"last_name",
	"email",
	"locale",
	"lang",
];

const DOCUMENTED = new Set([
	"riders.first_name",
	"team_events.name",
	"activities.name",
	"corrections.reason",
]);

async function columns(table: string): Promise<string[]> {
	const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{
		name: string;
	}>();
	return results.map((r) => r.name);
}

describe("schema minimisation", () => {
	it.each(Object.entries(COLUMNS))(
		"%s has exactly the documented columns",
		async (table, expected) => {
			expect((await columns(table)).sort()).toEqual([...expected].sort());
		},
	);

	it("appends the team-event breakdown to rynke_balances (migration 0006)", async () => {
		expect((await columns("rynke_balances")).at(-1)).toBe(
			"team_event_breakdown",
		);
	});

	it.each(Object.keys(COLUMNS))(
		"%s has no column for location, media, health, contact or language",
		async (table) => {
			for (const column of await columns(table)) {
				// `first_name` and a team event's `name` don't come from a ride.
				// `activities.name` is 008's documented exception: the ride's name,
				// shown only to its rider (008 research R1). A correction's reason
				// is organiser-written text, like an event's name (014).
				if (DOCUMENTED.has(`${table}.${column}`)) continue;
				for (const word of FORBIDDEN) expect(column).not.toContain(word);
			}
		},
	);
});
