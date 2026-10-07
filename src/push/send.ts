import type { Ctx } from "../ctx";
import { vapidAuthorization } from "./vapid";

// One push to one device (contracts/push-delivery.md "Push request"). The push
// has no body, so it carries nothing about the rider; the device shows a fixed
// text (FR-017). This logs nothing: the endpoint and the JWT must never reach
// the logs.

export type PushOutcome = "sent" | "gone" | "transient" | "refused";

export async function sendPush(
	endpoint: string,
	ctx: Ctx,
): Promise<PushOutcome> {
	const authorization = await vapidAuthorization(
		new URL(endpoint).origin,
		ctx.env,
		ctx.now(),
	);
	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers: {
				TTL: "86400",
				Urgency: "normal",
				Topic: "new-rynke",
				Authorization: authorization,
			},
			// An empty buffer sends `Content-Length: 0` and no `Content-Type`.
			body: new Uint8Array(0),
		});
	} catch {
		return "transient";
	}
	const { status } = response;
	if (status === 200 || status === 201 || status === 202) return "sent";
	if (status === 404 || status === 410) return "gone";
	if (status === 429 || (status >= 500 && status <= 599)) return "transient";
	return "refused";
}
