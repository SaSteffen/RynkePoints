import type { Ctx } from "../ctx";
import { hasBalance } from "../db/rider-view";
import { readSession } from "./session";

// Whether the signed-in rider's first data is there, for the waiting state's
// poll (015 contracts/http-routes.md, research R5). One D1 read and no Strava
// request (FR-006); it answers before the page dispatcher, so polling never
// renews the session, like `/me/notification-text`.

export async function handleReady(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	const headers = { "Cache-Control": "no-store" };
	const athleteId = await readSession(request, ctx.env, ctx.now());
	const ready =
		athleteId === null ? null : await hasBalance(ctx.env.DB, athleteId);
	if (ready === null) return new Response(null, { status: 401, headers });
	const body = request.method === "HEAD" ? null : JSON.stringify({ ready });
	return new Response(body, {
		headers: { ...headers, "Content-Type": "application/json" },
	});
}
