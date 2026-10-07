import { afterEach, describe, expect, it, vi } from "vitest";
import { type PushOutcome, sendPush } from "../../src/push/send";
import { makeCtx } from "../support/ctx";
import { installPushService, pushEndpoint } from "../support/push";

// One push request and how its answer is read (feature 010
// contracts/push-delivery.md "Push request").

const ctx = makeCtx();
const endpoint = pushEndpoint(1);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("sendPush", () => {
	it("posts an empty push with the contract's headers", async () => {
		const requests = installPushService(() => 201);
		expect(await sendPush(endpoint, ctx)).toBe("sent");
		expect(requests).toHaveLength(1);
		const [request] = requests;
		expect(request?.url).toBe(endpoint);
		expect(request?.method).toBe("POST");
		expect(request?.bodyLength).toBe(0);
		expect(request?.headers.get("TTL")).toBe("86400");
		expect(request?.headers.get("Urgency")).toBe("normal");
		expect(request?.headers.get("Topic")).toBe("new-rynke");
		expect(request?.headers.get("Authorization")).toMatch(
			/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/,
		);
		expect(request?.headers.has("Content-Encoding")).toBe(false);
	});

	it.each<[number | "throw", PushOutcome]>([
		[200, "sent"],
		[201, "sent"],
		[202, "sent"],
		[404, "gone"],
		[410, "gone"],
		[429, "transient"],
		[500, "transient"],
		[503, "transient"],
		["throw", "transient"],
		[400, "refused"],
		[401, "refused"],
		[403, "refused"],
		[413, "refused"],
	])("reads %s as %s", async (status, outcome) => {
		installPushService(() => status);
		expect(await sendPush(endpoint, ctx)).toBe(outcome);
	});

	it("logs nothing about the endpoint or the token", async () => {
		const spies = (["log", "info", "warn", "error"] as const).map((level) =>
			vi.spyOn(console, level).mockImplementation(() => {}),
		);
		for (const status of [201, 410, 503, 403, "throw"] as const) {
			installPushService(() => status);
			await sendPush(endpoint, ctx);
		}
		const lines = spies.flatMap((spy) => spy.mock.calls.map(String));
		for (const line of lines) {
			expect(line).not.toContain("synthetic-1");
			expect(line).not.toContain("vapid t=");
		}
	});
});
