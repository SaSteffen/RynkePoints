// Devices with notifications on (feature 010 data-model.md, research R7). A
// row is the endpoint the browser gave the device, its rider and the time it was
// turned on. Rows are deleted with the rider by the schema's cascade (FR-013).

export const MAX_ENDPOINT_LENGTH = 1024;

/** Turning on an 11th device drops the rider's oldest (research R7). */
export const MAX_SUBSCRIPTIONS_PER_RIDER = 10;

const PUSH_HOSTS = new Set([
	"fcm.googleapis.com",
	"updates.push.services.mozilla.com",
	"web.push.apple.com",
]);

/**
 * An `https:` URL without credentials or port on a known push service (research
 * R7). The table only takes, and the Worker only posts to, such endpoints, so a
 * client can't make the Worker send requests anywhere else.
 */
export function isPushEndpoint(value: string): boolean {
	if (value.length > MAX_ENDPOINT_LENGTH || !URL.canParse(value)) return false;
	const url = new URL(value);
	return (
		url.protocol === "https:" &&
		url.username === "" &&
		url.password === "" &&
		(PUSH_HOSTS.has(url.host) || url.host.endsWith(".notify.windows.com"))
	);
}

/** A device already registered moves to `athleteId` (spec edge case). */
export function upsertSubscriptionStatement(
	db: D1Database,
	endpoint: string,
	athleteId: number,
	now: number,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO push_subscriptions (endpoint, athlete_id, created_at)
			VALUES (?, ?, ?)
			ON CONFLICT (endpoint) DO UPDATE SET athlete_id = excluded.athlete_id,
				created_at = excluded.created_at`,
		)
		.bind(endpoint, athleteId, now);
}

/** Deletes the rider's rows that aren't among their newest 10. */
export function trimSubscriptionsStatement(
	db: D1Database,
	athleteId: number,
): D1PreparedStatement {
	return db
		.prepare(
			`DELETE FROM push_subscriptions WHERE athlete_id = ?1
			AND subscription_id NOT IN (
				SELECT subscription_id FROM push_subscriptions WHERE athlete_id = ?1
				ORDER BY created_at DESC, subscription_id DESC LIMIT ?2
			)`,
		)
		.bind(athleteId, MAX_SUBSCRIPTIONS_PER_RIDER);
}

/** Matches nothing when the endpoint belongs to another rider. */
export async function deleteSubscription(
	db: D1Database,
	endpoint: string,
	athleteId: number,
): Promise<void> {
	await db
		.prepare(
			"DELETE FROM push_subscriptions WHERE endpoint = ? AND athlete_id = ?",
		)
		.bind(endpoint, athleteId)
		.run();
}

export async function deleteSubscriptionById(
	db: D1Database,
	subscriptionId: number,
): Promise<void> {
	await db
		.prepare("DELETE FROM push_subscriptions WHERE subscription_id = ?")
		.bind(subscriptionId)
		.run();
}

export async function hasSubscription(
	db: D1Database,
	endpoint: string,
	athleteId: number,
): Promise<boolean> {
	const row = await db
		.prepare(
			"SELECT 1 AS found FROM push_subscriptions WHERE endpoint = ? AND athlete_id = ?",
		)
		.bind(endpoint, athleteId)
		.first();
	return row !== null;
}

/** Every device of these riders, by rider and then ID. */
export async function subscriptionIdsOfRiders(
	db: D1Database,
	athleteIds: number[],
): Promise<{ athleteId: number; subscriptionId: number }[]> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id, subscription_id FROM push_subscriptions
			WHERE athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY athlete_id, subscription_id`,
		)
		.bind(JSON.stringify(athleteIds))
		.all<{ athlete_id: number; subscription_id: number }>();
	return results.map((r) => ({
		athleteId: r.athlete_id,
		subscriptionId: r.subscription_id,
	}));
}

/** `null` when the row is gone or now belongs to another rider (FR-020). */
export async function subscriptionEndpoint(
	db: D1Database,
	subscriptionId: number,
	athleteId: number,
): Promise<string | null> {
	return db
		.prepare(
			"SELECT endpoint FROM push_subscriptions WHERE subscription_id = ? AND athlete_id = ?",
		)
		.bind(subscriptionId, athleteId)
		.first<string>("endpoint");
}
