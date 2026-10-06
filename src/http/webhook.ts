import { subscriptionId, verifyToken } from "../config";
import type { Ctx } from "../ctx";
import { ACTIVITY_ASPECTS, isId, isOneOf } from "../work/messages";

// Strava's push subscription (research R3, contracts/http-routes.md). Strava
// signs nothing, so the unguessable path secret and the subscription ID are the
// checks. Answers are for Strava, not riders: plain English, no catalogue. An
// event is only queued here, never processed, and Strava is never called
// (FR-011).

const MAX_BODY_BYTES = 1000;
const OBJECT_TYPES = ["activity", "athlete"] as const;

interface StravaEvent {
	objectType: (typeof OBJECT_TYPES)[number];
	objectId: number;
	aspect: (typeof ACTIVITY_ASPECTS)[number];
	updates: Record<string, unknown>;
	ownerId: number;
	subscriptionId: number;
}

function text(body: string, status: number): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

export async function handleWebhook(
	request: Request,
	secret: string,
	ctx: Ctx,
): Promise<Response> {
	if (!(await secretEquals(secret, verifyToken(ctx.env)))) {
		return text("Not Found", 404);
	}
	switch (request.method) {
		case "GET":
			return validateSubscription(new URL(request.url), ctx);
		case "POST":
			return receiveEvent(request, ctx);
		default:
			return new Response("Method Not Allowed", {
				status: 405,
				headers: { Allow: "GET, POST" },
			});
	}
}

/** Compares in constant time; hashing first makes the lengths equal. */
async function secretEquals(given: string, expected: string): Promise<boolean> {
	const digest = (value: string) =>
		crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	const [a, b] = await Promise.all([digest(given), digest(expected)]);
	return crypto.subtle.timingSafeEqual(a, b);
}

async function validateSubscription(url: URL, ctx: Ctx): Promise<Response> {
	const challenge = url.searchParams.get("hub.challenge");
	if (
		url.searchParams.get("hub.mode") !== "subscribe" ||
		challenge === null ||
		!(await secretEquals(
			url.searchParams.get("hub.verify_token") ?? "",
			verifyToken(ctx.env),
		))
	) {
		return text("Forbidden", 403);
	}
	return Response.json({ "hub.challenge": challenge });
}

async function receiveEvent(request: Request, ctx: Ctx): Promise<Response> {
	const body = await readBody(request);
	const event = body === null ? null : parseEvent(body);
	if (!event) return text("Bad Request", 400);
	if (event.subscriptionId !== subscriptionId(ctx.env)) {
		return text("ok", 200);
	}

	if (event.objectType === "activity") {
		await ctx.queue.send({
			kind: "activity-event",
			athleteId: event.ownerId,
			activityId: event.objectId,
			aspect: event.aspect,
			changed: Object.keys(event.updates),
		});
	}
	// Athlete events: deauthorization arrives with US3; anything else is dropped.
	return text("ok", 200);
}

/** The body as text, or null if it is over the limit. Stops reading there. */
async function readBody(request: Request): Promise<string | null> {
	const length = request.headers.get("Content-Length");
	if (length !== null && Number(length) > MAX_BODY_BYTES) return null;
	if (!request.body) return "";
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let body = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			return null;
		}
		body += decoder.decode(value, { stream: true });
	}
	return body + decoder.decode();
}

/** Validates the accepted event shape; other fields are ignored. */
function parseEvent(body: string): StravaEvent | null {
	let json: unknown;
	try {
		json = JSON.parse(body);
	} catch {
		return null;
	}
	if (typeof json !== "object" || json === null || Array.isArray(json)) {
		return null;
	}
	const e = json as Record<string, unknown>;
	const updates = e.updates ?? {};
	if (
		!isOneOf(OBJECT_TYPES, e.object_type) ||
		!isId(e.object_id) ||
		!isOneOf(ACTIVITY_ASPECTS, e.aspect_type) ||
		!isId(e.owner_id) ||
		!isId(e.subscription_id) ||
		typeof e.event_time !== "number" ||
		typeof updates !== "object" ||
		updates === null ||
		Array.isArray(updates)
	) {
		return null;
	}
	return {
		objectType: e.object_type,
		objectId: e.object_id,
		aspect: e.aspect_type,
		updates: updates as Record<string, unknown>,
		ownerId: e.owner_id,
		subscriptionId: e.subscription_id,
	};
}
