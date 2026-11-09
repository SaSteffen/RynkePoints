import type { SampleRider, SampleSet } from "./samples";
import { EUROPE_SAMPLES } from "./samples.europe";
import { HAMBURG_SAMPLES } from "./samples.hamburg";

// Each team's sample riders, by team id (feature 026 FR-050, data-model.md ›
// DevTarget).

const SAMPLE_SETS: Readonly<Record<string, SampleSet>> = {
	hamburg: HAMBURG_SAMPLES,
	europe: EUROPE_SAMPLES,
};

/** The sample set of team `teamId`; a team without one is a setup error. */
export function samplesFor(teamId: string): SampleSet {
	const set = Object.hasOwn(SAMPLE_SETS, teamId)
		? SAMPLE_SETS[teamId]
		: undefined;
	if (!set) throw new Error(`No sample riders for team "${teamId}"`);
	return set;
}

export function sampleRider(
	teamId: string,
	athleteId: number,
): SampleRider | undefined {
	return samplesFor(teamId).riders.find((r) => r.athleteId === athleteId);
}
