import { CONSENT_VERSIONS } from "./consent";
import type { Ctx } from "./ctx";
import { route } from "./http/router";
import { CATALOGS } from "./i18n/catalogs";
import { teamFor } from "./teams";
import { activityEvent } from "./work/activity-event";
import { checkMembership } from "./work/check-membership";
import { type Handlers, processBatch } from "./work/consumer";
import { deleteRider } from "./work/delete-rider";
import { evaluateRider } from "./work/evaluate-rider";
import { importPage } from "./work/import-page";
import { recheckRider } from "./work/recheck-rider";
import { rereadPage } from "./work/reread-page";
import { handleScheduled } from "./work/scheduled";
import { sendNotification } from "./work/send-notification";

// Entry points. Each builds a Ctx and delegates; tests call the exported
// handle* functions with their own Ctx (research R12).

const handlers: Handlers = {
	"activity-event": activityEvent,
	"import-page": importPage,
	"reread-page": rereadPage,
	"check-membership": checkMembership,
	"delete-rider": deleteRider,
	"evaluate-rider": evaluateRider,
	"send-notification": sendNotification,
	"recheck-rider": recheckRider,
};

function makeCtx(env: Env, exec: ExecutionContext): Ctx {
	return {
		env,
		queue: env.WORK_QUEUE,
		now: () => Math.floor(Date.now() / 1000),
		catalogs: CATALOGS,
		team: teamFor(env),
		consentVersions: CONSENT_VERSIONS,
		waitUntil: (promise) => exec.waitUntil(promise),
	};
}

export { handleScheduled };

export function handleFetch(request: Request, ctx: Ctx): Promise<Response> {
	return route(request, ctx);
}

export function handleQueue(
	batch: MessageBatch<unknown>,
	ctx: Ctx,
): Promise<void> {
	return processBatch(batch, ctx, handlers);
}

export default {
	fetch(request, env, exec) {
		return handleFetch(request, makeCtx(env, exec));
	},
	queue(batch, env, exec) {
		return handleQueue(batch, makeCtx(env, exec));
	},
	scheduled(controller, env, exec) {
		return handleScheduled(controller, makeCtx(env, exec));
	},
} satisfies ExportedHandler<Env, unknown>;
