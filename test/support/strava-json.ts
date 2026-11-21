import { idJson, isStravaId } from "../../src/strava/id";

// Strava's JSON (feature 042): the IDs the tests hold as strings go out as
// numbers with every digit, as Strava sends them. Other text under those
// keys, such as a map's `id`, stays text.
const ID_KEYS = new Set(["id", "object_id", "owner_id", "athleteId"]);

export function stravaJson(body: unknown): string {
	return JSON.stringify(body, (key, value) =>
		ID_KEYS.has(key) && isStravaId(value) ? idJson(value) : value,
	);
}
