import type { RecheckDay } from "../db/recheck";
import type { Dismissal, SourceState } from "../db/usage";
import {
	type RoutingDay,
	type RoutingWarning,
	routingWarnings,
} from "../routing/warning";
import type { CallDayRow } from "../strava/calls";
import { daysBefore } from "./allowances";
import { type CpuDay, cpuLevel, cpuRows } from "./cpu";
import type { Figure } from "./figures";

// What needs a look on Admin › Nutzung (feature 048 research R4, data-model.md
// "Attention item"): the list at the top of the page, the count in its head and
// the Admin tab's number all come from here, so they can't disagree (SC-005).
// Pure.

/** A mark's level, or `hint` for a state hint, which isn't counted (FR-004). */
export type AttentionLevel = "critical" | "warning" | "early" | "hint";

/** Whose CPU time: this team's Worker, the other teams' together, the gateway. */
export type CpuOwner = "own" | "others" | "shared";

export type AttentionItem =
	| {
			kind: "figure";
			level: "critical" | "warning" | "early";
			target: string;
			figure: Figure;
	  }
	| {
			kind: "cpu";
			level: "critical" | "warning";
			target: "#cpu";
			owner: CpuOwner;
			runs: number;
			cutOff: number;
	  }
	| {
			kind: "recheck";
			level: "warning";
			target: "#recheck";
			day: string;
			/** Riders waiting over 24 hours, a list in the wrong order; in that order. */
			reasons: RecheckReason[];
	  }
	| {
			kind: "routing";
			level: "warning";
			target: "#routing";
			day: string;
			reasons: RoutingWarning[];
	  }
	| {
			kind: "calls";
			level: "warning";
			target: "#strava-calls";
			day: string;
			reasons: ["calls"];
	  }
	| {
			kind: "team";
			level: "hint";
			target: "#strava";
			/** The other team's place in `USAGE_PEERS`, never its name (FR-025). */
			peer: number;
			/** Its last answer; null: it never answered. */
			lastSuccessAt: number | null;
	  }
	| { kind: "device"; level: "hint"; target: "/me/settings" };

/** The day warnings an administrator can dismiss (feature 050 FR-002). */
export type DayKind = "calls" | "recheck" | "routing";

export type RecheckReason = "over24h" | "unordered";

/** Why a day warning shows; a dismissal covers the reasons it was made for. */
export type DismissReason = "calls" | RecheckReason | RoutingWarning;

/**
 * Every reason each kind of day warning can show (feature 050 research R2):
 * what the dismiss route accepts and what the list's rows carry.
 */
export const DAY_REASONS: Record<DayKind, readonly DismissReason[]> = {
	calls: ["calls"],
	recheck: ["over24h", "unordered"],
	routing: ["missed", "possible", "everyone"],
};

export interface AttentionInputs {
	today: string;
	/** Every figure with a value, in the page's order. */
	figures: readonly Figure[];
	/** This team's id, which tells its CPU days from the other teams'. */
	self: string;
	cpu: readonly CpuDay[];
	recheck: readonly RecheckDay[];
	routing: readonly RoutingDay[];
	calls: readonly CallDayRow[];
	/** Each other team's exchange state, in `USAGE_PEERS` order. */
	peers: readonly (SourceState | undefined)[];
	/** Whether the viewer gets notifications on any device. */
	hasDevice: boolean;
	/**
	 * The viewer's dismissed day warnings (feature 050): a day item is left out
	 * when every reason it shows is among them, so a new reason brings it back.
	 */
	dismissed: readonly Dismissal[];
}

/** A re-check day with riders waiting over 24 hours or a list in the wrong order. */
export function isRecheckWarningDay(d: RecheckDay): boolean {
	return d.over24h > 0 || d.unordered > 0;
}

const RANK: Record<AttentionLevel, number> = {
	critical: 0,
	warning: 1,
	early: 2,
	hint: 3,
};

const CPU_OWNERS: readonly CpuOwner[] = ["own", "others", "shared"];

/**
 * Everything that needs a look, worst first; within a level in the page's
 * order: the figures, then Betrieb's rows (Strava calls, re-check, routing,
 * CPU), newer day first, then the state hints (FR-001, FR-002). Day marks count
 * from today and yesterday only; older ones stay in their tables.
 */
export function attentionItems(inputs: AttentionInputs): AttentionItem[] {
	const recent = (day: string) =>
		day === inputs.today || day === daysBefore(inputs.today, 1);
	const dismissed = new Set(
		inputs.dismissed.map((d) => `${d.kind} ${d.day} ${d.reason}`),
	);
	const shows = (kind: DayKind, day: string, reasons: readonly string[]) =>
		reasons.some((reason) => !dismissed.has(`${kind} ${day} ${reason}`));
	const items: AttentionItem[] = [];
	for (const figure of inputs.figures) {
		if (figure.level !== "ok") {
			items.push({
				kind: "figure",
				level: figure.level,
				target: `#${figure.id}`,
				figure,
			});
		}
	}
	const newestFirst = <T extends { day: string }>(days: readonly T[]) =>
		days.filter((d) => recent(d.day)).sort((a, b) => (a.day < b.day ? 1 : -1));
	for (const d of newestFirst(inputs.calls)) {
		if (d.marked && shows("calls", d.day, ["calls"])) {
			items.push({
				kind: "calls",
				level: "warning",
				target: "#strava-calls",
				day: d.day,
				reasons: ["calls"],
			});
		}
	}
	for (const d of newestFirst(inputs.recheck)) {
		const reasons: RecheckReason[] = [];
		if (d.over24h > 0) reasons.push("over24h");
		if (d.unordered > 0) reasons.push("unordered");
		if (reasons.length > 0 && shows("recheck", d.day, reasons)) {
			items.push({
				kind: "recheck",
				level: "warning",
				target: "#recheck",
				day: d.day,
				reasons,
			});
		}
	}
	for (const d of newestFirst(inputs.routing)) {
		const reasons = routingWarnings(d);
		if (reasons.length > 0 && shows("routing", d.day, reasons)) {
			items.push({
				kind: "routing",
				level: "warning",
				target: "#routing",
				day: d.day,
				reasons,
			});
		}
	}
	const cpu = cpuRows(
		inputs.cpu.filter((d) => d.day === inputs.today),
		inputs.self,
	)[0];
	for (const owner of CPU_OWNERS) {
		const record = cpu?.[owner];
		if (!record) continue;
		const level = cpuLevel(record.runs, record.cutOff);
		if (level !== "ok") {
			items.push({
				kind: "cpu",
				level,
				target: "#cpu",
				owner,
				runs: record.runs,
				cutOff: record.cutOff,
			});
		}
	}
	inputs.peers.forEach((state, peer) => {
		const success = state?.lastSuccessAt ?? null;
		const failure = state?.lastFailureAt ?? null;
		if (success === null || (failure !== null && failure > success)) {
			items.push({
				kind: "team",
				level: "hint",
				target: "#strava",
				peer,
				lastSuccessAt: success,
			});
		}
	});
	if (!inputs.hasDevice) {
		items.push({ kind: "device", level: "hint", target: "/me/settings" });
	}
	// Stable, so the page's order holds within a level.
	return items.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

export interface MarkCount {
	critical: number;
	warning: number;
	early: number;
	/** The head's and the Admin tab's number; state hints aren't in it. */
	total: number;
}

export function markCount(items: readonly AttentionItem[]): MarkCount {
	const count = { critical: 0, warning: 0, early: 0 };
	for (const item of items) {
		if (item.level !== "hint") count[item.level] += 1;
	}
	return { ...count, total: count.critical + count.warning + count.early };
}
