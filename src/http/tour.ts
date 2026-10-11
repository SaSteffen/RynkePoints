import { hasAgreed } from "../consent";
import type { Ctx } from "../ctx";
import { type Rider, setOnboarded, type TourId } from "../db/riders";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { forbidden } from "./errors";
import { html, type SafeHtml } from "./html";
import { redirect } from "./redirect";
import { isSameOrigin } from "./session";
import type { SectionId } from "./shell";
import { readViewer, riderConsentState } from "./viewer";

// Onboarding tours (issue #90): one short hint per page, on the real page,
// pointing at its navigation item. Which step shows comes from the page and
// `?tour=` in its address; the database only knows whether a tour is done, so
// finishing or skipping it counts on every device. The rider tour comes first;
// the organiser tour only for organisers, after it.

export interface TourStep {
	/** The page the step belongs to, without a query. */
	path: string;
	/** The navigation item it points at. */
	section: SectionId;
	text: MessageId;
}

export const TOURS: Record<TourId, readonly TourStep[]> = {
	rider: [
		{ path: "/team", section: "team", text: "tour.rider.team" },
		{ path: "/me", section: "you", text: "tour.rider.you" },
		{ path: "/me/rides", section: "rides", text: "tour.rider.rides" },
		{ path: "/me/settings", section: "settings", text: "tour.rider.settings" },
	],
	organiser: [
		{
			path: "/organiser/riders",
			section: "organiser",
			text: "tour.organiser.riders",
		},
		{ path: "/organiser", section: "organiser", text: "tour.organiser.events" },
	],
};

const INTRO: Record<TourId, MessageId> = {
	rider: "tour.rider.intro",
	organiser: "tour.organiser.intro",
};

function isTourId(value: unknown): value is TourId {
	return value === "rider" || value === "organiser";
}

/** The tours this rider may see: the organiser tour only for organisers. */
function allowed(rider: Rider, tour: TourId): boolean {
	return tour === "rider" || rider.organiser;
}

/** The first tour still to show, the rider tour before the organiser tour. */
export function pendingTour(rider: Rider): TourId | null {
	if (rider.onboardedAt === null) return "rider";
	if (rider.organiser && rider.organiserOnboardedAt === null) {
		return "organiser";
	}
	return null;
}

/** The address of a tour's step: its page, marked as in the tour. */
export function stepHref(tour: TourId, index: number): string {
	return `${TOURS[tour][index]?.path ?? "/"}?tour=${tour}`;
}

/** The hint on a page, and the navigation item it points at. */
export interface TourHint {
	card: SafeHtml;
	section: SectionId;
}

/**
 * The hint for the page at `path`: the step of the tour named in `?tour=`
 * when the page is one of its steps, else, while a tour is still to show,
 * its first step on its first page or an invitation to start it anywhere
 * else. Nothing otherwise.
 */
export function tourHint(
	i18n: I18n,
	rider: Rider,
	path: string,
	requested: string | null,
): TourHint | null {
	const page = path.split("?")[0] ?? path;
	if (isTourId(requested) && allowed(rider, requested)) {
		const index = TOURS[requested].findIndex((s) => s.path === page);
		if (index >= 0) return stepCard(i18n, requested, index, page);
	}
	const pending = pendingTour(rider);
	if (pending === null) return null;
	const first = TOURS[pending][0];
	if (!first) return null;
	if (first.path === page) return stepCard(i18n, pending, 0, page);
	return {
		section: first.section,
		card: card(
			i18n,
			pending,
			page,
			html`<p>${i18n.t(INTRO[pending])}</p>`,
			html`<a class="button" href="${stepHref(pending, 0)}">${i18n.t("tour.start")}</a>`,
		),
	};
}

function stepCard(
	i18n: I18n,
	tour: TourId,
	index: number,
	page: string,
): TourHint {
	const steps = TOURS[tour];
	const step = steps[index] as TourStep;
	const last = index === steps.length - 1;
	const progress = i18n.t("tour.progress", {
		step: String(index + 1),
		total: String(steps.length),
	});
	return {
		section: step.section,
		card: card(
			i18n,
			tour,
			page,
			html`<p class="tour-progress">${progress}</p>
<p>${i18n.t(step.text)}</p>`,
			last
				? html`<button class="button">${i18n.t("tour.done")}</button>`
				: html`<a class="button" href="${stepHref(tour, index + 1)}">${i18n.t("tour.next")}</a>`,
		),
	};
}

/**
 * The hint itself: its text, then the way on and Skip. Both Skip and the last
 * step's button send the form, which marks the tour done.
 */
function card(
	i18n: I18n,
	tour: TourId,
	page: string,
	text: SafeHtml,
	next: SafeHtml,
): SafeHtml {
	return html`<aside class="tour" aria-label="${i18n.t("tour.label")}">
${text}
<form method="post" action="/me/tour"><input type="hidden" name="tour" value="${tour}"><input type="hidden" name="page" value="${page}">${next}<button class="button-outlined">${i18n.t("tour.skip")}</button></form>
</aside>
`;
}

/** The pages a finished tour may return to: every step's page. */
const RETURN_PATHS = new Set(
	Object.values(TOURS).flatMap((steps) => steps.map((s) => s.path)),
);

/**
 * `POST /me/tour`: the rider finished or skipped a tour. It's recorded, and
 * the rider goes back to the page they were on, where the next tour, if any,
 * offers itself.
 */
export async function handleTour(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(i18n, "/me");
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "visitor") return redirect("/", 303);
	if (!hasAgreed(riderConsentState(viewer, ctx))) return redirect("/me", 303);
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		form = new FormData();
	}
	const tour = form.get("tour");
	const page = form.get("page");
	if (isTourId(tour) && allowed(viewer.rider, tour)) {
		await setOnboarded(ctx.env.DB, viewer.rider.athleteId, tour, ctx.now());
	}
	return redirect(
		typeof page === "string" && RETURN_PATHS.has(page) ? page : "/me",
		303,
	);
}
