// Queue message types (contracts/queue-messages.md). Bodies carry identifiers
// and enum values only, never activity data or tokens.

export const ACTIVITY_ASPECTS = ["create", "update", "delete"] as const;
export const DELETE_REASONS = [
	"deauthorized",
	"left-club",
	"reconnect-expired",
] as const;

export interface ActivityEventMessage {
	kind: "activity-event";
	athleteId: number;
	activityId: number;
	aspect: (typeof ACTIVITY_ASPECTS)[number];
	changed: string[];
}

export interface ImportPageMessage {
	kind: "import-page";
	athleteId: number;
	page: number;
	/** Season start (epoch seconds) when the import was started. */
	after: number;
}

/** The one-time re-read after FR-013 gained a figure (research R20). */
export interface RereadPageMessage {
	kind: "reread-page";
	athleteId: number;
	page: number;
	/** Season start (epoch seconds) when the re-read was started. */
	after: number;
}

export interface CheckMembershipMessage {
	kind: "check-membership";
	athleteId: number;
}

export interface DeleteRiderMessage {
	kind: "delete-rider";
	athleteId: number;
	reason: (typeof DELETE_REASONS)[number];
	revoke: boolean;
}

export type WorkMessage =
	| ActivityEventMessage
	| ImportPageMessage
	| RereadPageMessage
	| CheckMembershipMessage
	| DeleteRiderMessage;

export const isId = (v: unknown): v is number =>
	typeof v === "number" && Number.isSafeInteger(v) && v > 0;

export const isOneOf = <T extends string>(
	values: readonly T[],
	v: unknown,
): v is T => typeof v === "string" && (values as readonly string[]).includes(v);

/** Validates an untrusted body. Unknown fields are dropped. */
export function parseWorkMessage(body: unknown): WorkMessage | null {
	if (typeof body !== "object" || body === null) return null;
	const m = body as Record<string, unknown>;
	if (!isId(m.athleteId)) return null;
	const athleteId = m.athleteId;
	switch (m.kind) {
		case "activity-event":
			if (
				!isId(m.activityId) ||
				!isOneOf(ACTIVITY_ASPECTS, m.aspect) ||
				!Array.isArray(m.changed) ||
				!m.changed.every((c) => typeof c === "string")
			) {
				return null;
			}
			return {
				kind: m.kind,
				athleteId,
				activityId: m.activityId,
				aspect: m.aspect,
				changed: [...m.changed],
			};
		case "import-page":
		case "reread-page":
			if (
				!isId(m.page) ||
				typeof m.after !== "number" ||
				!Number.isSafeInteger(m.after) ||
				m.after < 0
			) {
				return null;
			}
			return { kind: m.kind, athleteId, page: m.page, after: m.after };
		case "check-membership":
			return { kind: m.kind, athleteId };
		case "delete-rider":
			if (!isOneOf(DELETE_REASONS, m.reason) || typeof m.revoke !== "boolean") {
				return null;
			}
			return { kind: m.kind, athleteId, reason: m.reason, revoke: m.revoke };
		default:
			return null;
	}
}

/** Canonical JSON with keys in contract order (matches `failed_work.message`). */
export function serializeWorkMessage(m: WorkMessage): string {
	switch (m.kind) {
		case "activity-event":
			return JSON.stringify({
				kind: m.kind,
				athleteId: m.athleteId,
				activityId: m.activityId,
				aspect: m.aspect,
				changed: m.changed,
			});
		case "import-page":
		case "reread-page":
			return JSON.stringify({
				kind: m.kind,
				athleteId: m.athleteId,
				page: m.page,
				after: m.after,
			});
		case "check-membership":
			return JSON.stringify({ kind: m.kind, athleteId: m.athleteId });
		case "delete-rider":
			return JSON.stringify({
				kind: m.kind,
				athleteId: m.athleteId,
				reason: m.reason,
				revoke: m.revoke,
			});
	}
}
