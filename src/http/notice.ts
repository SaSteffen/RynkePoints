import { clubId } from "../config";
import type { Ctx } from "../ctx";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { notFound } from "./errors";
import { html, htmlResponse, layout } from "./html";

// Public outcome pages with stable GET URLs (contracts/http-routes.md,
// research R18). They show no rider data and need no session. Retry links go to
// the start page, where the consent form is (R21).

export const NOTICE_IDS = [
	"expired",
	"denied",
	"denied-deleted",
	"consent-required",
	"team-full",
	"failed",
	"not-member",
	"not-member-deleted",
	"strava-busy",
	"not-connected",
	"deleted",
	"deleted-revoke-failed",
] as const;

export type NoticeId = (typeof NOTICE_IDS)[number];

interface Notice {
	title: MessageId;
	body: MessageId[];
	retry?: boolean;
}

const NOTICES: Record<NoticeId, Notice> = {
	expired: {
		title: "notice.expired.title",
		body: ["notice.expired.body"],
		retry: true,
	},
	denied: {
		title: "notice.denied.title",
		body: ["notice.denied.body"],
		retry: true,
	},
	"denied-deleted": {
		title: "notice.denied.title",
		body: ["notice.denied.body", "notice.deleted.body"],
		retry: true,
	},
	"consent-required": {
		title: "notice.consentRequired.title",
		body: ["notice.consentRequired.body", "notice.nothingStored"],
		retry: true,
	},
	"team-full": {
		title: "notice.teamFull.title",
		body: ["notice.teamFull.body"],
	},
	failed: {
		title: "notice.failed.title",
		body: ["notice.failed.body"],
		retry: true,
	},
	"not-member": {
		title: "notice.notMember.title",
		body: ["notice.notMember.body", "notice.nothingStored"],
	},
	"not-member-deleted": {
		title: "notice.notMember.title",
		body: ["notice.notMember.body", "notice.deleted.body"],
	},
	"strava-busy": {
		title: "notice.stravaBusy.title",
		body: ["notice.stravaBusy.body", "notice.nothingStored"],
		retry: true,
	},
	"not-connected": {
		title: "notice.notConnected.title",
		body: ["notice.notConnected.body", "notice.nothingStored"],
	},
	deleted: {
		title: "notice.deleted.title",
		body: ["notice.deleted.body"],
	},
	"deleted-revoke-failed": {
		title: "notice.deleted.title",
		body: ["notice.deleted.body", "notice.revokeFailed.body"],
	},
};

export function isNoticeId(id: string): id is NoticeId {
	return Object.hasOwn(NOTICES, id);
}

export function handleNotice(id: string, ctx: Ctx, i18n: I18n): Response {
	const path = `/notice/${id}`;
	if (!isNoticeId(id)) return notFound(i18n, path);
	const notice = NOTICES[id];
	const title = i18n.t(notice.title);
	const clubLink = html`<a href="https://www.strava.com/clubs/${clubId(ctx.env)}">${i18n.t("club.linkText")}</a>`;
	const paragraphs = notice.body.map(
		(message) => html`<p>${i18n.tHtml(message, { clubLink })}</p>`,
	);
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path,
			body: html`<h1>${title}</h1>
${paragraphs}
${notice.retry ? html`<p><a href="/">${i18n.t("notice.retry")}</a></p>` : ""}
<p><a href="/">${i18n.t("notice.backToStart")}</a></p>`,
		}),
	);
}
