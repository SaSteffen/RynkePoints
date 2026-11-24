import { verifyToken } from "../config";
import { secretEquals } from "../crypto/secret";
import type { Ctx } from "../ctx";
import { letGoRider, riderHold } from "../db/riders";
import { queueReport } from "../routing/report";
import { isStravaId, parseStravaJson } from "../strava/id";
import { readBodyUpTo } from "./body";

// The gateway's questions for another team: whether this team holds a person
// (feature 041 FR-012, research R14), and letting a rider go who switches
// (feature 044 R4, contracts/one-team.md). The answer is all that leaves the
// team; the question is neither stored nor logged.

const MAX_BODY_BYTES = 256;

/**
 * The athlete the gateway asks about, once the token in the path is the
 * team's; otherwise the response to answer with.
 */
async function gatewayAthlete(
	request: Request,
	secret: string,
	ctx: Ctx,
): Promise<string | Response> {
	if (!(await secretEquals(secret, verifyToken(ctx.env)))) {
		return new Response("Not Found", { status: 404 });
	}
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", {
			status: 405,
			headers: { Allow: "POST" },
		});
	}
	const body = await readBodyUpTo(request, MAX_BODY_BYTES);
	let athleteId: unknown;
	try {
		athleteId =
			body === null
				? undefined
				: // A JSON number with the exact digits (feature 042 research R3).
					(parseStravaJson(body, ["athleteId"]) as { athleteId?: unknown })
						?.athleteId;
	} catch {
		athleteId = undefined;
	}
	if (!isStravaId(athleteId))
		return new Response("Bad Request", { status: 400 });
	return athleteId;
}

/**
 * `POST /strava/held/<token>`: whether this team holds the person, and as a
 * rider (feature 041 research R14, feature 044 R2).
 */
export async function handleHeld(
	request: Request,
	secret: string,
	ctx: Ctx,
): Promise<Response> {
	const athleteId = await gatewayAthlete(request, secret, ctx);
	if (athleteId instanceof Response) return athleteId;
	return Response.json(await riderHold(ctx.env.DB, athleteId));
}

/**
 * `POST /strava/let-go/<token>`: the person chose to switch to another team
 * (feature 044 R4). Lets a rider go, never a guest, and confirms either way.
 */
export async function handleLetGo(
	request: Request,
	secret: string,
	ctx: Ctx,
): Promise<Response> {
	const athleteId = await gatewayAthlete(request, secret, ctx);
	if (athleteId instanceof Response) return athleteId;
	await letGoRider(ctx.env.DB, athleteId);
	// A guest stays held; the report says what is true now (feature 046).
	await queueReport(ctx, athleteId);
	return Response.json({ letGo: true });
}
