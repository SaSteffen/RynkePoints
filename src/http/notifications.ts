import type { Ctx } from "../ctx";
import {
	deleteSubscription,
	hasSubscription,
	isPushEndpoint,
	trimSubscriptionsStatement,
	upsertSubscriptionStatement,
} from "../db/push-subscriptions";
import { isSameOrigin, readSession } from "./session";

// `POST /me/notifications`, called by `public/app.js` only (feature 010
// contracts/http-routes.md). It turns this device's notifications on or off
// for the signed-in rider, or reports whether they are on. Failures have an
// empty body; no response holds rider data.

const ACTIONS = ["on", "off", "check"] as const;

function empty(status: number): Response {
	return new Response(null, {
		status,
		headers: { "Cache-Control": "no-store" },
	});
}

function on(value: boolean): Response {
	return Response.json(
		{ on: value },
		{ headers: { "Cache-Control": "no-store" } },
	);
}

export async function handleNotifications(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	if (!isSameOrigin(request)) return empty(403);
	const athleteId = await readSession(request, ctx.env, ctx.now());
	if (athleteId === null) return empty(401);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return empty(400);
	}
	const action = form.get("action");
	const endpoint = form.get("endpoint");
	if (
		!ACTIONS.some((a) => a === action) ||
		typeof endpoint !== "string" ||
		!isPushEndpoint(endpoint)
	) {
		return empty(400);
	}

	const db = ctx.env.DB;
	switch (action) {
		case "on":
			await db.batch([
				upsertSubscriptionStatement(db, endpoint, athleteId, ctx.now()),
				trimSubscriptionsStatement(db, athleteId),
			]);
			return on(true);
		case "off":
			await deleteSubscription(db, endpoint, athleteId);
			return on(false);
		default:
			return on(await hasSubscription(db, endpoint, athleteId));
	}
}
