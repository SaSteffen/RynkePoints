import { describe, expect, it } from "vitest";
import {
	compareIds,
	idJson,
	idsJson,
	isStravaId,
	parseStravaJson,
	toStravaId,
} from "../../src/strava/id";

// Feature 042: IDs above 2^53 − 1 stay exact (research R2–R4).
const MAX = "9223372036854775807";

describe("isStravaId", () => {
	it("accepts positive whole numbers of at most 64 bits", () => {
		for (const id of ["1", "900001", "9007199254740993", MAX]) {
			expect(isStravaId(id)).toBe(true);
		}
	});

	it("refuses anything else", () => {
		for (const id of [
			"0",
			"01",
			"-1",
			"1.5",
			"1e3",
			" 1",
			"",
			"9223372036854775808",
			"12345678901234567890",
			1,
			null,
		]) {
			expect(isStravaId(id)).toBe(false);
		}
	});
});

describe("toStravaId", () => {
	it("takes a valid string as it is", () => {
		expect(toStravaId(MAX)).toBe(MAX);
	});

	it("takes a positive safe integer from the previous version", () => {
		expect(toStravaId(900001)).toBe("900001");
	});

	it("refuses unsafe, fractional and non-positive numbers", () => {
		for (const v of [2 ** 53, 1.5, 0, -3, Number.NaN]) {
			expect(toStravaId(v)).toBeNull();
		}
	});
});

describe("compareIds", () => {
	it("orders by numeric value, not by text", () => {
		const ids = ["10", "9", "9007199254740993", "9007199254740992", "100"];
		expect(ids.sort(compareIds)).toEqual([
			"9",
			"10",
			"100",
			"9007199254740992",
			"9007199254740993",
		]);
		expect(compareIds("42", "42")).toBe(0);
	});
});

describe("parseStravaJson", () => {
	it("keeps the exact digits of every id, nested ones too", () => {
		const parsed = parseStravaJson(
			`[{"id": ${MAX}, "athlete": {"id": 9007199254740993}, "distance": 1.5}]`,
		);
		expect(parsed).toEqual([
			{ id: MAX, athlete: { id: "9007199254740993" }, distance: 1.5 },
		]);
	});

	it("ignores id_str: the ID is the digits of id", () => {
		expect(
			parseStravaJson(`{"id": 9007199254740993, "id_str": "9007199254740992"}`),
		).toEqual({ id: "9007199254740993", id_str: "9007199254740992" });
	});

	it("reads the named keys only", () => {
		expect(
			parseStravaJson(
				`{"object_id": 9007199254740993, "owner_id": 5, "subscription_id": 9}`,
				["object_id", "owner_id"],
			),
		).toEqual({
			object_id: "9007199254740993",
			owner_id: "5",
			subscription_id: 9,
		});
	});

	it("takes no ID sent as text: Strava sends numbers only", () => {
		const parsed = parseStravaJson(`{"id": "7001"}`) as { id: string };
		expect(isStravaId(parsed.id)).toBe(false);
	});

	it("keeps a fraction or exponent as its text, which is no ID", () => {
		const parsed = parseStravaJson(`{"id": 1e3}`) as { id: string };
		expect(isStravaId(parsed.id)).toBe(false);
	});
});

describe("idJson", () => {
	it("writes the exact digits as a JSON number", () => {
		expect(JSON.stringify({ athleteId: idJson(MAX) })).toBe(
			`{"athleteId":${MAX}}`,
		);
		expect(idsJson(["1", "9007199254740993"])).toBe("[1,9007199254740993]");
	});
});
