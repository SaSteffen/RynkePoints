import { describe, expect, it } from "vitest";
import { gatewayFetch } from "../../gateway/index";
import { EUROPE, gatewayEnv, HAMBURG } from "./support";

// contracts/gateway.md › Routes: `/auth/return/<teamId>` (FR-007, US1).

async function back(
	path: string,
	headers: Record<string, string> = {},
): Promise<Response> {
	return gatewayFetch(
		new Request(`https://gateway.example.test${path}`, { headers }),
		gatewayEnv,
	);
}

describe("/auth/return/<teamId>", () => {
	it("sends the rider on to the team's callback with Strava's answer", async () => {
		const res = await back(
			"/auth/return/hamburg?code=abc&state=s1&scope=read,activity:read",
		);
		expect(res.status).toBe(302);
		const target = new URL(res.headers.get("Location") ?? "");
		expect(target.origin).toBe(HAMBURG);
		expect(target.pathname).toBe("/auth/callback");
		expect(Object.fromEntries(target.searchParams)).toEqual({
			code: "abc",
			state: "s1",
			scope: "read,activity:read",
		});
	});

	it("copies a refusal", async () => {
		const res = await back("/auth/return/europe?error=access_denied&state=s2");
		const target = new URL(res.headers.get("Location") ?? "");
		expect(target.origin).toBe(EUROPE);
		expect(Object.fromEntries(target.searchParams)).toEqual({
			error: "access_denied",
			state: "s2",
		});
	});

	it("gives 404 for an unknown team", async () => {
		expect((await back("/auth/return/paris?code=abc&state=s")).status).toBe(
			404,
		);
	});

	it("never lets the request change the target", async () => {
		const res = await back(
			"/auth/return/hamburg?code=abc&state=s&next=https://evil.example&redirect_uri=https://evil.example&origin=https://evil.example",
			{ Host: "evil.example", "X-Forwarded-Host": "evil.example" },
		);
		const target = new URL(res.headers.get("Location") ?? "");
		expect(target.origin).toBe(HAMBURG);
		expect([...target.searchParams.keys()]).toEqual(["code", "state"]);
	});

	it("only answers GET", async () => {
		const res = await gatewayFetch(
			new Request("https://gateway.example.test/auth/return/hamburg", {
				method: "POST",
			}),
			gatewayEnv,
		);
		expect(res.status).toBe(404);
	});
});
