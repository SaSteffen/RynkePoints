// The peloton's breakaway (feature 016 FR-018, research R13): the riders far
// ahead of the bunch. Pure; it sees only the totals, no rider.

/** Fewer totals say too little about the bunch. */
const MIN_TOTALS = 5;

/** The quantile `p` of sorted values, interpolated between the closest ranks. */
function quantile(sorted: readonly number[], p: number): number {
	const rank = (sorted.length - 1) * p;
	const below = Math.floor(rank);
	const low = sorted[below] ?? 0;
	const high = sorted[below + 1] ?? low;
	return low + (rank - below) * (high - low);
}

/**
 * The upper outlier fence, Q3 + 1.5 × (Q3 − Q1); a total strictly above it
 * rides in the breakaway. `null` below five totals or when nobody is above it.
 */
export function breakawayFence(totals: readonly number[]): number | null {
	if (totals.length < MIN_TOTALS) return null;
	const sorted = [...totals].sort((a, b) => a - b);
	const q1 = quantile(sorted, 0.25);
	const q3 = quantile(sorted, 0.75);
	const fence = q3 + 1.5 * (q3 - q1);
	return (sorted.at(-1) ?? 0) > fence ? fence : null;
}
