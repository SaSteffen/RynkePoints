import { verifyToken } from "../config";
import { secretEquals } from "../crypto/secret";
import type { Ctx } from "../ctx";
import { riderHold } from "../db/riders";
import { isId } from "../work/messages";
import { readBodyUpTo } from "./body";

// `POST /strava/held/<token>`: the gateway asks, for another team about to
// withdraw a grant, whether this team holds the person (feature 041 FR-012,
// research R14, contracts/withdrawal.md). The answer is all that leaves the
// team; the question is neither stored nor logged.

const MAX_BODY_BYTES = 256;

export async function handleHeld(
	request: Request,
	secret: string,
	ctx: Ctx,
): Promise<Response> {
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
				: (JSON.parse(body) as { athleteId?: unknown })?.athleteId;
	} catch {
		athleteId = undefined;
	}
	if (!isId(athleteId)) return new Response("Bad Request", { status: 400 });
	return Response.json({ held: await riderHold(ctx.env.DB, athleteId) });
}
