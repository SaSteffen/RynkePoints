// Strava's activity and athlete IDs (feature 042). After June 1, 2027 they
// may use the full 64-bit range, beyond what a JavaScript number holds
// exactly (2^53 − 1), so the app keeps them as decimal strings everywhere.
// D1 stores them in its INTEGER columns exactly: they are bound as text and
// read back with CAST(… AS TEXT) (research R5). This module owns reading
// them exactly from Strava's JSON and writing them back as JSON numbers.

/** SQLite's INTEGER, and so the largest ID the database holds exactly. */
const MAX_ID = 9223372036854775807n;

/** A positive whole number of at most 64 bits, in canonical digits. */
export function isStravaId(v: unknown): v is string {
	return (
		typeof v === "string" && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= MAX_ID
	);
}

/**
 * An ID from an untrusted value: a valid string, or a positive safe integer
 * as the previous version wrote into queue messages and work rows (R6).
 */
export function toStravaId(v: unknown): string | null {
	if (typeof v === "number") {
		return Number.isSafeInteger(v) && v > 0 ? String(v) : null;
	}
	return isStravaId(v) ? v : null;
}

/** Numeric order of two valid IDs: no leading zeros, so shorter is smaller. */
export function compareIds(a: string, b: string): number {
	return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

type Reviver = (
	this: unknown,
	key: string,
	value: unknown,
	context?: { source?: string },
) => unknown;

/**
 * Parses Strava's JSON with the exact digits of every number under one of
 * `keys`, as a string (research R2). Strava sends IDs as numbers only, so a
 * text value there becomes "", no ID. Strava's `id_str` is ignored: webhook
 * events have none, so every ID is read one way, from its digits (R1).
 * Callers still check the result with `isStravaId`: a fraction or exponent
 * stays its text.
 */
export function parseStravaJson(
	text: string,
	keys: readonly string[] = ["id"],
): unknown {
	const reviver: Reviver = (key, value, context) => {
		if (!keys.includes(key)) return value;
		if (typeof value === "number") {
			// Without source text (no runtime here lacks it) only a safe
			// integer is exact; anything else must not pass as an ID.
			return (
				context?.source ?? (Number.isSafeInteger(value) ? String(value) : "")
			);
		}
		return typeof value === "string" ? "" : value;
	};
	return (JSON.parse as (text: string, reviver: Reviver) => unknown)(
		text,
		reviver,
	);
}

/** The ID as a JSON number with its exact digits, for `JSON.stringify` (R3). */
export function idJson(id: string): unknown {
	return (JSON as JSON & { rawJSON(text: string): unknown }).rawJSON(id);
}

/** A JSON array of IDs as exact numbers, to bind for `json_each` (R3). */
export function idsJson(ids: readonly string[]): string {
	return JSON.stringify(ids.map(idJson));
}
