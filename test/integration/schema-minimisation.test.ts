import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// The stored columns are exactly those in data-model.md (FR-014, SC-007,
// FR-029a). A new column means a data-model.md change and a reviewed update
// here, so nothing sensitive or a rider's language slips into D1 unnoticed.

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
	],
	consent_records: ["athlete_id", "version", "accepted_at"],
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

	it.each(Object.keys(COLUMNS))(
		"%s has no column for location, media, health, contact or language",
		async (table) => {
			for (const column of await columns(table)) {
				// `first_name` is the one documented exception to `name`.
				if (column === "first_name") continue;
				for (const word of FORBIDDEN) expect(column).not.toContain(word);
			}
		},
	);
});
