import { describe, expect, it } from "vitest";
import { signValue } from "../../src/crypto/sign";
import {
	readUndoToken,
	safeBack,
	undoToken,
} from "../../src/http/organiser/requests";

// The undo of a quick decision (feature 019 research R4, data-model.md "Undo
// token"). Synthetic athlete IDs and a test key only.

const KEY = "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=";
const NOW = 1_791_000_000;
const VALUE = {
	decision: "confirm" as const,
	eventId: 12,
	reports: [
		{ athleteId: 900001, reportedAt: NOW - 50 },
		{ athleteId: 900002, reportedAt: NOW - 20 },
	],
};

describe("undo token", () => {
	it("round-trips the decision, the event and each report's time", async () => {
		const token = await undoToken(VALUE, NOW, KEY);
		expect(await readUndoToken(token, NOW + 60, KEY)).toEqual(VALUE);
	});

	it("carries a denial of one report", async () => {
		const deny = {
			decision: "deny" as const,
			eventId: 3,
			reports: [{ athleteId: 900003, reportedAt: NOW }],
		};
		const token = await undoToken(deny, NOW, KEY);
		expect(await readUndoToken(token, NOW, KEY)).toEqual(deny);
	});

	it("expires after 10 minutes", async () => {
		const token = await undoToken(VALUE, NOW, KEY);
		expect(await readUndoToken(token, NOW + 599, KEY)).not.toBeNull();
		expect(await readUndoToken(token, NOW + 601, KEY)).toBeNull();
	});

	it("refuses a tampered token and one signed for another purpose", async () => {
		const token = await undoToken(VALUE, NOW, KEY);
		const tampered = token.replace("confirm-12-", "confirm-13-");
		expect(await readUndoToken(tampered, NOW, KEY)).toBeNull();
		const other = await signValue("confirm-12-900001-1", NOW + 600, KEY, "");
		expect(await readUndoToken(other, NOW, KEY)).toBeNull();
		expect(await readUndoToken("", NOW, KEY)).toBeNull();
	});
});

describe("safeBack", () => {
	it("allows the Termine page and the overview with a group", () => {
		expect(safeBack("/organiser")).toBe("/organiser");
		expect(safeBack("/organiser/riders")).toBe("/organiser/riders");
		expect(safeBack("/organiser/riders?group=requests")).toBe(
			"/organiser/riders?group=requests",
		);
	});

	it("falls back to the Termine page for anything else", () => {
		for (const value of [
			"https://evil.test/",
			"//evil.test",
			"/organiser/riders?group=x",
			"/me",
			null,
		]) {
			expect(safeBack(value)).toBe("/organiser");
		}
	});
});
