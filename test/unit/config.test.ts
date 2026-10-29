import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
	clientId,
	clientSecret,
	clubId,
	contactEmail,
	organiserFigures,
	privacyController,
	readyPollSeconds,
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

describe("readyPollSeconds", () => {
	it("reads the configured interval", () => {
		expect(readyPollSeconds({ READY_POLL_SECONDS: "10" })).toBe(10);
		expect(readyPollSeconds(env)).toBe(10);
	});

	it.each(["1", "60"])("accepts %j", (value) => {
		expect(readyPollSeconds({ READY_POLL_SECONDS: value })).toBe(Number(value));
	});

	it.each(["0", "61", "x", "", "1.5"])("rejects %j", (value) => {
		expect(() => readyPollSeconds({ READY_POLL_SECONDS: value })).toThrow();
	});
});

describe("privacyController", () => {
	it("is the non-empty lines, trimmed", () => {
		expect(
			privacyController({ PRIVACY_CONTROLLER: " Name \n\n Street 1\n" }),
		).toEqual(["Name", "Street 1"]);
	});

	it("rejects an empty setting", () => {
		expect(() => privacyController({ PRIVACY_CONTROLLER: " \n " })).toThrow();
	});
});

describe("contactEmail", () => {
	it("is the address, trimmed", () => {
		expect(contactEmail({ CONTACT_EMAIL: " a@b.example " })).toBe(
			"a@b.example",
		);
	});

	it.each(["", "nobody", "a@b", 'a"@b.example', "a b@c.example"])(
		"rejects %j",
		(value) => {
			expect(() => contactEmail({ CONTACT_EMAIL: value })).toThrow();
		},
	);
});

describe("organiserFigures", () => {
	it.each(["full", "percent"])("reads %j", (value) => {
		expect(organiserFigures({ ORGANISER_FIGURES: value })).toBe(value);
	});

	it.each(["", "Percent", "amounts"])("rejects %j", (value) => {
		expect(() => organiserFigures({ ORGANISER_FIGURES: value })).toThrow();
	});
});
