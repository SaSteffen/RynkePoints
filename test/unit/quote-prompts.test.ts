import { describe, expect, it } from "vitest";
import data from "../../art/quotes/monkeys.json";
import { buildPrompt } from "../../scripts/badge-prompts.mjs";
import { validateMonkeys } from "../../scripts/quote-prompts.mjs";

// The quote monkeys' art inputs: the five pictures of Rynke who says the Team
// page's quote, listed in art/quotes/monkeys.json and prompted like the badges.

type Monkey = { id: string; name: string; scene: string };

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
