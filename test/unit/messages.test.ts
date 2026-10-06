import { describe, expect, it } from "vitest";
import {
	parseWorkMessage,
	serializeWorkMessage,
	type WorkMessage,
} from "../../src/work/messages";

const valid: WorkMessage[] = [
	{
		kind: "activity-event",
		athleteId: 900001,
		activityId: 7001,
		aspect: "update",
		changed: ["type", "private"],
	},
	{ kind: "import-page", athleteId: 900001, page: 2, after: 1767222000 },
	{ kind: "import-page", athleteId: 900001, page: 1, after: 0 },
	{ kind: "check-membership", athleteId: 900001 },
	{
		kind: "delete-rider",
		athleteId: 900001,
		reason: "deauthorized",
		revoke: false,
	},
	{
		kind: "delete-rider",
		athleteId: 900001,
		reason: "left-club",
		revoke: true,
	},
	{
		kind: "delete-rider",
		athleteId: 900001,
		reason: "reconnect-expired",
		revoke: true,
	},
];

describe("parseWorkMessage", () => {
	it.each(valid)("accepts $kind", (message) => {
		expect(parseWorkMessage(structuredClone(message))).toEqual(message);
	});

	it("accepts every activity aspect", () => {
		for (const aspect of ["create", "update", "delete"]) {
			expect(
				parseWorkMessage({
					kind: "activity-event",
					athleteId: 1,
					activityId: 2,
					aspect,
					changed: [],
				}),
			).not.toBeNull();
		}
	});

	it("drops unknown extra fields", () => {
		expect(
			parseWorkMessage({
				kind: "check-membership",
				athleteId: 900001,
				token: "x",
			}),
		).toEqual({ kind: "check-membership", athleteId: 900001 });
	});

	it.each([
		["not an object", "check-membership"],
		["null", null],
		["unknown kind", { kind: "poll", athleteId: 1 }],
		["string id", { kind: "check-membership", athleteId: "900001" }],
		["fractional id", { kind: "check-membership", athleteId: 1.5 }],
		["zero id", { kind: "check-membership", athleteId: 0 }],
		[
			"fractional activity id",
			{
				kind: "activity-event",
				athleteId: 1,
				activityId: 2.5,
				aspect: "create",
				changed: [],
			},
		],
		[
			"unknown aspect",
			{
				kind: "activity-event",
				athleteId: 1,
				activityId: 2,
				aspect: "merge",
				changed: [],
			},
		],
		[
			"non-string changed",
			{
				kind: "activity-event",
				athleteId: 1,
				activityId: 2,
				aspect: "update",
				changed: [1],
			},
		],
		["page 0", { kind: "import-page", athleteId: 1, page: 0, after: 0 }],
		["missing after", { kind: "import-page", athleteId: 1, page: 1 }],
		[
			"negative after",
			{ kind: "import-page", athleteId: 1, page: 1, after: -1 },
		],
		[
			"unknown reason",
			{ kind: "delete-rider", athleteId: 1, reason: "bored", revoke: true },
		],
		[
			"non-boolean revoke",
			{ kind: "delete-rider", athleteId: 1, reason: "left-club", revoke: 1 },
		],
	])("rejects %s", (_label, body) => {
		expect(parseWorkMessage(body)).toBeNull();
	});
});

describe("serializeWorkMessage", () => {
	it("writes keys in contract order regardless of input order", () => {
		const shuffled = {
			changed: ["title"],
			aspect: "update",
			activityId: 7001,
			athleteId: 900001,
			kind: "activity-event",
		} as WorkMessage;
		expect(serializeWorkMessage(shuffled)).toBe(
			'{"kind":"activity-event","athleteId":900001,"activityId":7001,"aspect":"update","changed":["title"]}',
		);
		expect(
			serializeWorkMessage({
				revoke: true,
				reason: "left-club",
				athleteId: 900001,
				kind: "delete-rider",
			} as WorkMessage),
		).toBe(
			'{"kind":"delete-rider","athleteId":900001,"reason":"left-club","revoke":true}',
		);
		expect(
			serializeWorkMessage({
				after: 5,
				page: 1,
				athleteId: 900001,
				kind: "import-page",
			} as WorkMessage),
		).toBe('{"kind":"import-page","athleteId":900001,"page":1,"after":5}');
	});

	it.each(valid)("round-trips $kind", (message) => {
		expect(parseWorkMessage(JSON.parse(serializeWorkMessage(message)))).toEqual(
			message,
		);
	});
});
