// The peloton's breakaway (feature 016 FR-018, research R13): the riders who
// have opened a gap in front of the bunch. Pure; it sees only the totals, no
// rider.

/** Fewer totals say too little about the bunch. */
const MIN_TOTALS = 5;
/** Two neighbours further apart than this share of the median have a gap. */
const GAP_SHARE = 0.4;

export interface Breakaway {
	/** The bunch's highest total; every total above it rides in the breakaway. */
	fence: number;
	/** The breakaway's groups from the back, each its distinct totals ascending. */
	groups: number[][];
}

/** The quantile `p` of sorted values, interpolated between the closest ranks. */
function quantile(sorted: readonly number[], p: number): number {
	const rank = (sorted.length - 1) * p;
	const below = Math.floor(rank);
	const low = sorted[below] ?? 0;
	const high = sorted[below + 1] ?? low;
	return low + (rank - below) * (high - low);
}

/**
 * The bunch is the riders around the median rider with no gap between
 * neighbours: none further apart than `GAP_SHARE` × the median, and at least 1
 * apart. Everyone ahead of the bunch's first gap rides in the breakaway, split
 * into groups at the same gaps. `null` below five totals or when nobody is
 * ahead of the bunch. The bunch holds the median rider, so the breakaway is
 * always less than half of the riders.
 */
export function breakaway(totals: readonly number[]): Breakaway | null {
	if (totals.length < MIN_TOTALS) return null;
	const sorted = [...totals].sort((a, b) => a - b);
	const gap = Math.max(1, GAP_SHARE * quantile(sorted, 0.5));
	const apart = (low: number, high: number) => high - low > gap;
	// The median rider; with an even count the upper one of the middle two.
	let front = Math.ceil((sorted.length - 1) / 2);
	while (
		front < sorted.length - 1 &&
		!apart(sorted[front] ?? 0, sorted[front + 1] ?? 0)
	) {
		front++;
	}
	if (front === sorted.length - 1) return null;
	const groups: number[][] = [];
	for (const total of new Set(sorted.slice(front + 1))) {
		const group = groups.at(-1);
		const last = group?.at(-1);
		if (group && last !== undefined && !apart(last, total)) group.push(total);
		else groups.push([total]);
	}
	return { fence: sorted[front] ?? 0, groups };
}
