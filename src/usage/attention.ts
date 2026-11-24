import type { RecheckDay } from "../db/recheck";
import type { SourceState } from "../db/usage";
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
			over24h: boolean;
			unordered: boolean;
	  }
	| {
			kind: "routing";
			level: "warning";
			target: "#routing";
			day: string;
			reasons: RoutingWarning[];
	  }
	| { kind: "calls"; level: "warning"; target: "#strava-calls"; day: string }
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
		if (d.marked) {
			items.push({
				kind: "calls",
				level: "warning",
				target: "#strava-calls",
				day: d.day,
			});
		}
	}
	for (const d of newestFirst(inputs.recheck)) {
		if (isRecheckWarningDay(d)) {
			items.push({
				kind: "recheck",
				level: "warning",
				target: "#recheck",
				day: d.day,
				over24h: d.over24h > 0,
				unordered: d.unordered > 0,
			});
		}
	}
	for (const d of newestFirst(inputs.routing)) {
		const reasons = routingWarnings(d);
		if (reasons.length > 0) {
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
