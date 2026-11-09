import type { ConsentVersions } from "./consent";
import type { Catalogs } from "./i18n/catalogs";
import type { TeamData } from "./teams/types";
import type { WorkMessage } from "./work/messages";

/**
 * Everything a handler needs, built once per invocation in `src/index.ts`.
 * Tests build their own with a recording queue and a fixed clock (research R12).
 */
export interface Ctx {
	env: Env;
	queue: Pick<Queue<WorkMessage>, "send" | "sendBatch">;
	/** Current time in epoch seconds. */
	now: () => number;
	catalogs: Catalogs;
	/** The team this deployment serves, from `TEAM_ID` (feature 026 R1). */
	team: TeamData;
	/** The published consent versions; the last is current (004 research R11). */
	consentVersions: ConsentVersions;
	/** Keeps the invocation alive for work that outlives the response. */
	waitUntil: (promise: Promise<unknown>) => void;
}
