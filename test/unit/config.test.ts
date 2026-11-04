import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
	clientId,
	clientSecret,
	clubId,
	contactEmail,
	memberClubIds,
	organiserFigures,
	organiserProgressGraph,
	privacyController,
	readyPollSeconds,
	seasonStartEpoch,
	subscriptionId,
	trainingLeaderboard,
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
		expect(clubId(env)).toBe(1088689);
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

describe("memberClubIds", () => {
	const ids = (extra: string) =>
		memberClubIds({ STRAVA_CLUB_ID: "1088689", STRAVA_EXTRA_CLUB_IDS: extra });

	it("lists the team club first, then the further clubs", () => {
		expect(memberClubIds(env)).toEqual([1088689, 2372209]);
		expect(ids(" 2372209 , 42 ")).toEqual([1088689, 2372209, 42]);
	});

	it("is only the team club when there are no further clubs", () => {
		expect(ids("")).toEqual([1088689]);
		expect(ids("1088689")).toEqual([1088689]);
	});

	it("rejects a non-numeric club", () => {
		expect(() => ids("2372209,abc")).toThrow();
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

describe("organiserProgressGraph", () => {
	it("reads on and off", () => {
		expect(organiserProgressGraph({ ORGANISER_PROGRESS_GRAPH: "on" })).toBe(
			true,
		);
		expect(organiserProgressGraph({ ORGANISER_PROGRESS_GRAPH: "off" })).toBe(
			false,
		);
	});

	it.each(["", "true", "Off", "0"])("rejects %j", (value) => {
		expect(() =>
			organiserProgressGraph({ ORGANISER_PROGRESS_GRAPH: value }),
		).toThrow();
	});
});

describe("trainingLeaderboard", () => {
	it("reads on and off", () => {
		expect(trainingLeaderboard({ TRAINING_LEADERBOARD: "on" })).toBe(true);
		expect(trainingLeaderboard({ TRAINING_LEADERBOARD: "off" })).toBe(false);
	});

	it.each(["", "true", "Off", "0"])("rejects %j", (value) => {
		expect(() =>
			trainingLeaderboard({ TRAINING_LEADERBOARD: value }),
		).toThrow();
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
