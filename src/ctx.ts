import type { Catalogs } from "./i18n/catalogs";
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
}
