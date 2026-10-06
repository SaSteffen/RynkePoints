import type { Ctx } from "./ctx";
import { route } from "./http/router";
import { CATALOGS } from "./i18n/catalogs";
import { activityEvent } from "./work/activity-event";
import { type Handlers, processBatch } from "./work/consumer";
import { importPage } from "./work/import-page";
import { requeueFailedWork } from "./work/scheduled";

// Entry points. Each builds a Ctx and delegates; tests call the exported
// handle* functions with their own Ctx (research R12).

const handlers: Handlers = {
	"activity-event": activityEvent,
	"import-page": importPage,
};

function makeCtx(env: Env): Ctx {
	return {
		env,
		queue: env.WORK_QUEUE,
		now: () => Math.floor(Date.now() / 1000),
		catalogs: CATALOGS,
	};
}

export function handleFetch(request: Request, ctx: Ctx): Promise<Response> {
	return route(request, ctx);
}

export function handleQueue(
	batch: MessageBatch<unknown>,
	ctx: Ctx,
): Promise<void> {
	return processBatch(batch, ctx, handlers);
}

export async function handleScheduled(
	_controller: ScheduledController,
	ctx: Ctx,
): Promise<void> {
	// The daily membership fan-out arrives with US3.
	await requeueFailedWork(ctx);
}

export default {
	fetch(request, env) {
		return handleFetch(request, makeCtx(env));
	},
	queue(batch, env) {
		return handleQueue(batch, makeCtx(env));
	},
	scheduled(controller, env) {
		return handleScheduled(controller, makeCtx(env));
	},
} satisfies ExportedHandler<Env, unknown>;
