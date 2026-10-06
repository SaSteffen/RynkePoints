import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
	clientId,
	clientSecret,
	clubId,
	seasonStartEpoch,
	subscriptionId,
	verifyToken,
} from "../../src/config";

describe("seasonStartEpoch", () => {
	it("is 00:00 Europe/Berlin in winter time", () => {
		expect(seasonStartEpoch("2026-01-01")).toBe(
			Date.parse("2025-12-31T23:00:00Z") / 1000,
		);
	});

	it("is 00:00 Europe/Berlin in summer time", () => {
		expect(seasonStartEpoch("2026-07-01")).toBe(
			Date.parse("2026-06-30T22:00:00Z") / 1000,
		);
	});

	it.each(["", "2026-1-1", "2026-13-01", "2026-02-30", "01.01.2026", "soon"])(
		"rejects %j",
		(value) => {
			expect(() => seasonStartEpoch(value)).toThrow();
		},
	);
});

describe("env accessors", () => {
	it("parses numeric settings", () => {
		expect(clubId(env)).toBe(2372209);
		expect(subscriptionId(env)).toBe(777);
	});

	it("rejects non-numeric settings", () => {
		expect(() => clubId({ ...env, STRAVA_CLUB_ID: "abc" })).toThrow();
		expect(() =>
			subscriptionId({ ...env, STRAVA_SUBSCRIPTION_ID: "" }),
		).toThrow();
	});

	it("exposes the Strava app credentials", () => {
		expect(clientId(env)).toBe("10001");
		expect(clientSecret(env)).toBe("test-client-secret");
		expect(verifyToken(env)).toBe("test-verify-token");
	});
});
