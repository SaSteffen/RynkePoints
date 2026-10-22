import { describe, expect, it } from "vitest";
import data from "../../art/quotes/monkeys.json";
import shows from "../../art/shows/shows.json";
import { buildPrompt } from "../../scripts/badge-prompts.mjs";
import {
	validateMonkeys,
	validateShows,
} from "../../scripts/quote-prompts.mjs";

// The quote monkeys' art inputs: the five pictures of Rynke who says the Team
// page's quote, listed in art/quotes/monkeys.json and prompted like the badges.

type Monkey = {
	id: string;
	name: string;
	scene: string;
	holes?: unknown;
	erase?: unknown;
};

const monkey = (over: Partial<Record<keyof Monkey, unknown>> = {}) => ({
	id: "wave",
	name: "Hallo du!",
	scene: "Waving. {{kit}}",
	...over,
});
const valid = (monkeys: unknown[]) => ({
	snippets: { kit: "Helmet and jersey." },
	monkeys,
});

describe("validateMonkeys", () => {
	it("accepts the real monkey list, eleven of them", () => {
		expect(validateMonkeys(data)).toEqual([]);
		expect(data.monkeys).toHaveLength(11);
	});

	it("rejects duplicate and malformed ids", () => {
		expect(validateMonkeys(valid([monkey(), monkey()])).join("\n")).toMatch(
			/wave: duplicate/,
		);
		expect(
			validateMonkeys(valid([monkey({ id: "Big Wave" })])).join("\n"),
		).toMatch(/lower-case/);
	});

	it("rejects a missing name, an empty scene and unknown snippets", () => {
		const problems = validateMonkeys(
			valid([
				monkey({ name: "" }),
				monkey({ id: "flex", scene: " " }),
				monkey({ id: "point", scene: "Pointing. {{bike}}" }),
			]),
		).join("\n");
		expect(problems).toMatch(/wave: no name/);
		expect(problems).toMatch(/flex: empty scene/);
		expect(problems).toMatch(/point: unknown snippet {{bike}}/);
	});

	it("accepts holes as [x, y] pixel pairs and rejects anything else", () => {
		expect(validateMonkeys(valid([monkey({ holes: [[1021, 1668]] })]))).toEqual(
			[],
		);
		for (const holes of [[[1, 2, 3]], [[-1, 2]], [[1.5, 2]], "1,2"]) {
			expect(validateMonkeys(valid([monkey({ holes })])).join("\n")).toMatch(
				/wave: holes must be/,
			);
		}
	});

	it("accepts erase as [x0, y0, x1, y1] pixel boxes and rejects anything else", () => {
		expect(
			validateMonkeys(valid([monkey({ erase: [[0, 1150, 460, 1950]] })])),
		).toEqual([]);
		for (const erase of [
			[[0, 0, 10]],
			[[10, 0, 5, 10]],
			[[0, -1, 5, 10]],
			{},
		]) {
			expect(validateMonkeys(valid([monkey({ erase })])).join("\n")).toMatch(
				/wave: erase must be/,
			);
		}
	});

	it("rejects a list without monkeys", () => {
		expect(validateMonkeys({})).toEqual(["monkeys.json: no monkeys list"]);
		expect(validateMonkeys(valid([]))).toEqual([
			"monkeys.json: the list is empty",
		]);
	});
});

describe("a monkey's prompt", () => {
	it("fills the scene and its snippets into the template", () => {
		const wave: Monkey = {
			id: "wave",
			name: "Hallo du!",
			scene: "Waving. {{kit}}",
		};
		const prompt = buildPrompt(
			"Pose: {{scene}}",
			{ kit: "Helmet and jersey." },
			{ ...wave, group: "", category: "", threshold: 1 },
		);
		expect(prompt).toBe("Pose: Waving. Helmet and jersey.");
	});
});

// Feature 022 contracts/show-pictures.md: Rynke on the unicorn and at the disco.
describe("validateShows", () => {
	const show = (id: string, over: Record<string, unknown> = {}) => ({
		id,
		name: "Show",
		scene: "Dancing. {{kit}}",
		...over,
	});
	const list = (items: unknown[]) => ({
		snippets: { kit: "Helmet and jersey." },
		shows: items,
	});

	it("accepts the real list: the unicorn, then the disco", () => {
		expect(validateShows(shows)).toEqual([]);
		expect(shows.shows.map((s) => s.id)).toEqual(["unicorn", "disco"]);
		for (const s of shows.shows) {
			expect(s.name.trim()).not.toBe("");
			expect(s.scene.trim()).not.toBe("");
		}
	});

	it("takes the quote monkeys' kit as it is", () => {
		expect(shows.snippets.kit).toBe(data.snippets.kit);
	});

	it("rejects a missing, an extra or a reordered show", () => {
		for (const items of [
			[show("unicorn")],
			[show("unicorn"), show("disco"), show("moon")],
			[show("disco"), show("unicorn")],
		]) {
			expect(validateShows(list(items)).join("\n")).toMatch(
				/the shows must be unicorn and disco/,
			);
		}
	});

	it("checks each show as a quote monkey is checked", () => {
		const problems = validateShows(
			list([
				show("unicorn", { name: "" }),
				show("disco", { scene: "Dancing. {{bike}}" }),
			]),
		).join("\n");
		expect(problems).toMatch(/unicorn: no name/);
		expect(problems).toMatch(/disco: unknown snippet {{bike}}/);
		expect(validateShows({})).toEqual(["shows.json: no shows list"]);
	});

	it("fills a show's scene and its snippets into the template", () => {
		const unicorn = shows.shows[0] as {
			id: string;
			name: string;
			scene: string;
		};
		const prompt = buildPrompt("Pose: {{scene}}", shows.snippets, {
			...unicorn,
			group: "",
			category: "",
			threshold: 1,
		});
		expect(prompt).toContain(shows.snippets.kit);
		expect(prompt).not.toMatch(/{{\w+}}/);
	});
});
