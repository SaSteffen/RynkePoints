import { afterEach, describe, expect, it, vi } from "vitest";
import {
	exportSince,
	fetchPeerCounts,
	parseExport,
	parsePeers,
	pullSince,
} from "../../src/usage/peers";

// The usage exchange between teams (feature 026 contracts/usage-exchange.md) as
// pure checks: what a team accepts as another team's address and answer, and
// which days it asks for. Synthetic teams and origins; nothing is reached.

const TODAY = "2026-11-04";

describe("parsePeers", () => {
	it("reads a list of other teams", () => {
		expect(
			parsePeers(
				'[{"id":"europe","origin":"https://europe.example.org"}]',
				"hamburg",
			),
		).toEqual([{ id: "europe", origin: "https://europe.example.org" }]);
	});

	it("allows plain http only for local hosts", () => {
		expect(
			parsePeers(
				'[{"id":"europe","origin":"http://europe.localhost:8790"}]',
				"hamburg",
			),
		).toHaveLength(1);
		expect(() =>
			parsePeers('[{"id":"europe","origin":"http://example.org"}]', "hamburg"),
		).toThrow("invalid entry");
	});

	it.each([
		["a path", "https://europe.example.org/admin"],
		["a trailing slash", "https://europe.example.org/"],
		["credentials", "https://user:pw@europe.example.org"],
		["another scheme", "ftp://europe.example.org"],
		["no URL", "europe"],
	])("refuses an origin with %s", (_, origin) => {
		expect(() =>
			parsePeers(JSON.stringify([{ id: "europe", origin }]), "hamburg"),
		).toThrow("invalid entry");
	});

	it.each([
		["upper case", "Europe"],
		["a slash", "eu/rope"],
		["a number first", "1team"],
	])("refuses a team id with %s", (_, id) => {
		expect(() =>
			parsePeers(
				JSON.stringify([{ id, origin: "https://europe.example.org" }]),
				"hamburg",
			),
		).toThrow("invalid entry");
	});

	it("refuses this team itself and a team named twice", () => {
		const peer = { id: "europe", origin: "https://europe.example.org" };
		expect(() => parsePeers(JSON.stringify([peer]), "europe")).toThrow(
			"repeats",
		);
		expect(() => parsePeers(JSON.stringify([peer, peer]), "hamburg")).toThrow(
			"repeats",
		);
	});

	it("refuses anything but a list", () => {
		expect(() => parsePeers("{}", "hamburg")).toThrow("not a list");
		expect(() => parsePeers("not json", "hamburg")).toThrow();
	});
});

describe("parseExport", () => {
	const count = { day: TODAY, allowance: "strava_read_daily", count: 3 };

	it("reads the named team's counts", () => {
		expect(parseExport({ team: "europe", days: [count] }, "europe")).toEqual([
			count,
		]);
	});

	it("refuses another team's answer", () => {
		expect(parseExport({ team: "hamburg", days: [count] }, "europe")).toBe(
			null,
		);
	});

	it.each([
		["a negative count", { ...count, count: -1 }],
		["a fractional count", { ...count, count: 1.5 }],
		["an unsafe count", { ...count, count: 2 ** 60 }],
		[
			"an allowance that isn't exchanged",
			{ ...count, allowance: "cf_d1_rows_read" },
		],
		["a malformed day", { ...count, day: "4.11.2026" }],
		["no object", "3"],
	])("refuses the whole answer with %s", (_, entry) => {
		expect(
			parseExport({ team: "europe", days: [count, entry] }, "europe"),
		).toBe(null);
	});

	it("refuses an answer longer than thirteen months could be", () => {
		const days = Array.from({ length: 1_501 }, () => count);
		expect(parseExport({ team: "europe", days }, "europe")).toBe(null);
	});
});

describe("the days asked for", () => {
	it("pulls from yesterday at first, and when up to date", () => {
		expect(pullSince(null, TODAY)).toBe("2026-11-03");
		expect(pullSince("2026-11-03", TODAY)).toBe("2026-11-03");
		expect(pullSince(TODAY, TODAY)).toBe("2026-11-03");
	});

	it("pulls missed days from the last one stored, at most a month back", () => {
		expect(pullSince("2026-10-20", TODAY)).toBe("2026-10-20");
		expect(pullSince("2026-01-01", TODAY)).toBe("2026-10-04");
	});

	it("exports from what's asked, within the history and not after today", () => {
		expect(exportSince("2026-10-20", TODAY)).toBe("2026-10-20");
		expect(exportSince("2027-01-01", TODAY)).toBe(TODAY);
		expect(exportSince("2020-01-01", TODAY) > "2020-01-01").toBe(true);
		expect(exportSince(null, TODAY)).toBe("2026-11-03");
		expect(exportSince("2026-13-45", TODAY)).toBe("2026-11-03");
	});
});

describe("fetchPeerCounts", () => {
	const peer = { id: "europe", origin: "https://europe.example.org" };

	afterEach(() => vi.unstubAllGlobals());

	it("doesn't follow a redirect, and says so", async () => {
		const fetchStub = vi.fn(
			async () =>
				new Response(null, {
					status: 302,
					headers: { Location: "https://elsewhere.example.org/" },
				}),
		);
		vi.stubGlobal("fetch", fetchStub);
		expect(await fetchPeerCounts(peer, "synthetic", TODAY)).toEqual({
			kind: "unavailable",
			reason: "HTTP 302",
		});
		expect(fetchStub).toHaveBeenCalledOnce();
		const [, init] = fetchStub.mock.calls[0] as unknown as [URL, RequestInit];
		expect(init.redirect).toBe("manual");
	});

	it("says a team is unavailable when it can't be reached or reads badly", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("network");
			}),
		);
		expect(await fetchPeerCounts(peer, "synthetic", TODAY)).toEqual({
			kind: "unavailable",
			reason: "TypeError",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("<html>", { status: 200 })),
		);
		expect(await fetchPeerCounts(peer, "synthetic", TODAY)).toEqual({
			kind: "unavailable",
			reason: "unreadable response",
		});
	});

	it("asks the export with the token and the first day", async () => {
		const fetchStub = vi.fn(async () =>
			Response.json({ team: "europe", days: [] }),
		);
		vi.stubGlobal("fetch", fetchStub);
		expect(await fetchPeerCounts(peer, "synthetic", "2026-11-01")).toEqual({
			kind: "ok",
			days: [],
		});
		const [url, init] = fetchStub.mock.calls[0] as unknown as [
			URL,
			RequestInit,
		];
		expect(String(url)).toBe(
			"https://europe.example.org/admin/usage/export?since=2026-11-01",
		);
		expect(new Headers(init.headers).get("Authorization")).toBe(
			"Bearer synthetic",
		);
	});
});
