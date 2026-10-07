import { berlinDate, subscriptionId, verifyToken } from "../../src/config";
import type { Ctx } from "../../src/ctx";
import { handleFetch } from "../../src/index";
import { type RideRecipe, recipeToActivity, sampleRider } from "./samples";
import {
	deleteActivity,
	type FakeActivity,
	getActivity,
	insertActivity,
	updateActivity,
} from "./store";

// Simulated Strava events (specs/006-local-frontend-dev research R8,
// contracts/dev-routes.md "Simulated events"). Each action changes the fake's
// store first, then posts Strava's webhook body to the app's real webhook
// route, so the app acks, enqueues and processes it like any other event.

/** The last body sent, for "send again" (module memory, lost on reload). */
let lastEvent: string | null = null;

type Form = Pick<FormData, "get">;

function field(form: Form, name: string): string | null {
	const value = form.get(name);
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function numberField(form: Form, name: string): number | null {
	const value = field(form, name);
	return value === null || !Number.isFinite(Number(value))
		? null
		: Number(value);
}

/** `"true"`/`"on"` → true, `"false"` → false, missing → null. */
function flagField(form: Form, name: string): boolean | null {
	const value = field(form, name);
	if (value === null) return null;
	return value === "true" || value === "on";
}

/** A ride on `date` at `time` (Europe/Berlin), from the form's figures. */
function recipeFrom(form: Form, defaults: RideRecipe): RideRecipe {
	const movingMin = numberField(form, "movingMin") ?? defaults.movingMin;
	return {
		daysAgo: 0,
		startTime: field(form, "time") ?? defaults.startTime,
		sportType: field(form, "sportType") ?? defaults.sportType,
		distanceKm: numberField(form, "distanceKm") ?? defaults.distanceKm,
		elevationM: numberField(form, "elevationM") ?? defaults.elevationM,
		movingMin,
		elapsedMin: numberField(form, "elapsedMin") ?? movingMin + 10,
		manual: flagField(form, "manual") ?? false,
		private: flagField(form, "private") ?? false,
	};
}

/** Strava's names for the fields an update changed, as its events send them. */
function updatesFor(
	before: FakeActivity,
	after: FakeActivity,
): Record<string, string> {
	const updates: Record<string, string> = {};
	if (after.sport_type !== before.sport_type) updates.type = after.sport_type;
	if (after.private !== before.private) updates.private = String(after.private);
	for (const key of [
		"start_date",
		"distance",
		"total_elevation_gain",
		"moving_time",
		"elapsed_time",
		"manual",
	] as const) {
		if (after[key] !== before[key]) updates[key] = String(after[key]);
	}
	return updates;
}

/** The activity after applying the form's non-empty fields. */
function updated(activity: FakeActivity, form: Form): FakeActivity {
	const next: FakeActivity = { ...activity };
	const date = field(form, "date");
	const time = field(form, "time");
	if (date || time) {
		const [day = "", clock = ""] = activity.start_date_local.split("T");
		const moved = recipeToActivity(
			{
				daysAgo: 0,
				startTime: time ?? clock.slice(0, 5),
				sportType: activity.sport_type,
				distanceKm: 0,
				elevationM: 0,
				movingMin: 0,
			},
			date ?? day,
			"",
			activity.id,
		);
		next.start_date = moved.start_date;
		next.start_date_local = moved.start_date_local;
	}
	const sportType = field(form, "sportType");
	if (sportType) next.sport_type = sportType;
	const km = numberField(form, "distanceKm");
	if (km !== null) next.distance = Math.round(km * 1000);
	const elevation = numberField(form, "elevationM");
	if (elevation !== null) next.total_elevation_gain = elevation;
	const moving = numberField(form, "movingMin");
	if (moving !== null) next.moving_time = moving * 60;
	const elapsed = numberField(form, "elapsedMin");
	if (elapsed !== null) next.elapsed_time = elapsed * 60;
	const isPrivate = flagField(form, "private");
	if (isPrivate !== null) next.private = isPrivate;
	const manual = flagField(form, "manual");
	if (manual !== null) next.manual = manual;
	return next;
}

async function send(ctx: Ctx, origin: string, body: string): Promise<number> {
	lastEvent = body;
	const res = await handleFetch(
		new Request(`${origin}/strava/webhook/${verifyToken(ctx.env)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		}),
		ctx,
	);
	return res.status;
}

function eventBody(
	ctx: Ctx,
	event: {
		objectType: "activity" | "athlete";
		aspect: "create" | "update" | "delete";
		objectId: number;
		ownerId: number;
		updates?: Record<string, string>;
	},
): string {
	return JSON.stringify({
		object_type: event.objectType,
		aspect_type: event.aspect,
		object_id: event.objectId,
		owner_id: event.ownerId,
		event_time: ctx.now(),
		subscription_id: subscriptionId(ctx.env),
		updates: event.updates ?? {},
	});
}

/**
 * Runs one `POST /_dev/events` action and returns the text to show on
 * `/_dev/`, naming the webhook route's answer.
 */
export async function simulateEvent(
	ctx: Ctx,
	origin: string,
	form: Form,
): Promise<string> {
	const action = field(form, "action") ?? "";
	if (action === "repeat") {
		if (lastEvent === null) return "Nothing to repeat yet";
		return `Sent the last event again: webhook answered ${await send(ctx, origin, lastEvent)}`;
	}

	const rider = sampleRider(Number(field(form, "athleteId")));
	if (!rider) return "Unknown sample rider";
	const db = ctx.env.DB;
	const who = `${rider.firstName} (${rider.athleteId})`;
	const activity = (base: Omit<Parameters<typeof eventBody>[1], "ownerId">) =>
		eventBody(ctx, { ...base, ownerId: rider.athleteId });

	if (action === "create") {
		const recipe = recipeFrom(form, {
			daysAgo: 0,
			startTime: "09:00",
			sportType: "Ride",
			distanceKm: 40,
			elevationM: 300,
			movingMin: 90,
		});
		const date = field(form, "date") ?? berlinDate(ctx.now());
		const body = recipeToActivity(recipe, date, "", 0);
		const id = await insertActivity(db, rider.athleteId, body);
		const status = await send(
			ctx,
			origin,
			activity({ objectType: "activity", aspect: "create", objectId: id }),
		);
		return `New ride ${id} for ${who}: webhook answered ${status}`;
	}

	if (action === "deauthorize") {
		const status = await send(
			ctx,
			origin,
			eventBody(ctx, {
				objectType: "athlete",
				aspect: "update",
				objectId: rider.athleteId,
				ownerId: rider.athleteId,
				updates: { authorized: "false" },
			}),
		);
		return `${who} revoked access: webhook answered ${status}`;
	}

	const id = Number(field(form, "activityId"));
	const stored = await getActivity(db, id);
	if (!stored || stored.athleteId !== rider.athleteId) {
		return `Ride ${field(form, "activityId") ?? ""} isn't ${who}'s`;
	}
	if (action === "update") {
		const next = updated(stored.body, form);
		await updateActivity(db, next);
		const status = await send(
			ctx,
			origin,
			activity({
				objectType: "activity",
				aspect: "update",
				objectId: id,
				updates: updatesFor(stored.body, next),
			}),
		);
		return `Changed ride ${id} of ${who}: webhook answered ${status}`;
	}
	if (action === "delete") {
		await deleteActivity(db, id);
		const status = await send(
			ctx,
			origin,
			activity({ objectType: "activity", aspect: "delete", objectId: id }),
		);
		return `Deleted ride ${id} of ${who}: webhook answered ${status}`;
	}
	return `Unknown action ${action}`;
}
