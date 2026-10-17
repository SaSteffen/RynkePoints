import { hasAgreed } from "../consent";
import type { Ctx } from "../ctx";
import { type Rider, setOnboarded, type TourId } from "../db/riders";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import { CURRENT_RULES, type RynkeRules } from "../rynke/rules";
import { virtualShareRequired } from "../rynke/tally";
import { forbidden } from "./errors";
import { html, type SafeHtml } from "./html";
import { redirect } from "./redirect";
import { isSameOrigin } from "./session";
import type { SectionId } from "./shell";
import type { TourTarget } from "./tour-targets";
import { readViewer, riderConsentState } from "./viewer";

// Onboarding tours (issue #90, feature 020): hints on the real pages, each
// pointing at the page's navigation item or at one element on it (FR-003). A
// page may have several steps; the address names the step, `?tour=` and
// `&step=` (FR-004), and the database only knows whether a tour is done, so
// finishing or skipping it counts on every device. The rider tour comes first;
// the organiser tour only for organisers, after it. The steps are chosen per
// viewer (FR-002): Termine only for riders who aren't organisers, who have Orga
// in its place (feature 019 research R8). On Du and Fahrten the rider tour
// shows the example rider of `tour-example.ts` (FR-005), on Orga the organiser
// tour its example team (FR-013).

export interface TourStep {
	/** The page the step belongs to, without a query. */
	path: string;
	/** The navigation item of the page. */
	section: SectionId;
	text: MessageId;
	/** The element it points at instead of the navigation item (FR-003). */
	target?: TourTarget;
	/** The page shows the example rider or team (FR-005, FR-013). */
	example?: true;
	/** Only for riders who aren't organisers (feature 019's Termine). */
	riderOnly?: true;
}

/** Every step of each tour; `tourSteps` picks the viewer's (FR-001). */
export const TOURS: Record<TourId, readonly TourStep[]> = {
	rider: [
		{ path: "/team", section: "team", text: "tour.rider.team" },
		{
			path: "/team",
			section: "team",
			text: "tour.rider.peloton",
			target: "tour-peloton",
		},
		{ path: "/me", section: "you", text: "tour.rider.you", example: true },
		{
			path: "/me",
			section: "you",
			text: "tour.rider.elevation",
			target: "tour-elevation",
			example: true,
		},
		{
			path: "/me",
			section: "you",
			text: "tour.rider.teamRynke",
			target: "tour-team",
			example: true,
		},
		{
			path: "/me",
			section: "you",
			text: "tour.rider.outdoor",
			target: "tour-outdoor",
			example: true,
		},
		{
			path: "/me/rides",
			section: "rides",
			text: "tour.rider.rides",
			target: "tour-rejected-ride",
			example: true,
		},
		{
			path: "/me/rides",
			section: "rides",
			text: "tour.rider.shortRide",
			target: "tour-short-ride",
			example: true,
		},
		{ path: "/me/badges", section: "badges", text: "tour.rider.badges" },
		{
			path: "/events",
			section: "events",
			text: "tour.rider.events",
			riderOnly: true,
		},
		{ path: "/me/settings", section: "settings", text: "tour.rider.settings" },
	],
	organiser: [
		{
			path: "/organiser/riders",
			section: "organiser",
			text: "tour.organiser.riders",
			example: true,
		},
		{
			path: "/organiser/riders",
			section: "organiser",
			text: "tour.organiser.groups",
			target: "tour-groups",
			example: true,
		},
		{
			path: "/organiser/riders",
			section: "organiser",
			text: "tour.organiser.pace",
			target: "tour-pace",
			example: true,
		},
		{
			path: "/organiser",
			section: "organiser",
			text: "tour.organiser.requests",
			target: "tour-requests",
			example: true,
		},
		{
			path: "/organiser",
			section: "organiser",
			text: "tour.organiser.newEvent",
			target: "tour-new-event",
			example: true,
		},
		{
			path: "/organiser",
			section: "organiser",
			text: "tour.organiser.upcoming",
			target: "tour-later-event",
			example: true,
		},
		{
			path: "/organiser",
			section: "organiser",
			text: "tour.organiser.past",
			target: "tour-past-event",
			example: true,
		},
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

/** The steps of `tour` for this viewer (FR-002). */
export function tourSteps(
	tour: TourId,
	viewer: Pick<Rider, "organiser">,
): TourStep[] {
	return TOURS[tour].filter((step) => !(step.riderOnly && viewer.organiser));
}

/** The first tour still to show, the rider tour before the organiser tour. */
export function pendingTour(rider: Rider): TourId | null {
	if (rider.onboardedAt === null) return "rider";
	if (rider.organiser && rider.organiserOnboardedAt === null) {
		return "organiser";
	}
	return null;
}

/**
 * The address of the viewer's step `index` of a tour: its page, marked as in
 * the tour with the step's number, and the element it points at as the
 * fragment, so the browser brings it into view (FR-003, FR-004).
 */
export function stepHref(
	tour: TourId,
	viewer: Pick<Rider, "organiser">,
	index: number,
): string {
	const step = tourSteps(tour, viewer)[index];
	if (!step) return "/";
	const fragment = step.target ? `#${step.target}` : "";
	return `${step.path}?tour=${tour}&step=${index + 1}${fragment}`;
}

/** The hint on a page, and what it points at. */
export interface TourHint {
	card: SafeHtml;
	/** The navigation item it points at; `null` when it points at an element. */
	section: SectionId | null;
	/**
	 * Whether the page shows the example rider or team instead of the real
	 * data (FR-005, FR-013).
	 */
	example: boolean;
}

/**
 * The hint for the page at `path`: the step of the tour named in `?tour=`
 * when the page is one of its steps (the one `&step=` names, else the page's
 * first), else, while a tour is still to show, its first step on its first
 * page or an invitation to start it anywhere else. Nothing otherwise.
 */
export function tourHint(
	i18n: I18n,
	rider: Rider,
	path: string,
	query: URLSearchParams,
): TourHint | null {
	const page = path.split("?")[0] ?? path;
	const requested = query.get("tour");
	if (isTourId(requested) && allowed(rider, requested)) {
		const steps = tourSteps(requested, rider);
		const number = Number(query.get("step"));
		const named = Number.isInteger(number) ? steps[number - 1] : undefined;
		const index =
			named?.path === page
				? number - 1
				: steps.findIndex((s) => s.path === page);
		if (index >= 0) return stepCard(i18n, rider, requested, index, page);
	}
	const pending = pendingTour(rider);
	if (pending === null) return null;
	const first = tourSteps(pending, rider)[0];
	if (!first) return null;
	if (first.path === page) return stepCard(i18n, rider, pending, 0, page);
	return {
		section: first.section,
		example: false,
		card: card(
			i18n,
			pending,
			page,
			null,
			html`<p>${i18n.t(INTRO[pending])}</p>`,
			html`<a class="button" href="${stepHref(pending, rider, 0)}">${i18n.t("tour.start")}</a>`,
		),
	};
}

/**
 * The rule values the hints name, from the rules in effect (FR-008). Every
 * hint gets them all; a text uses the ones it names.
 */
function ruleParams(i18n: I18n, rules: RynkeRules): Record<string, string> {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const amounts = rules.teamEvents;
	return {
		distanceKm: whole(rules.distanceStepKm),
		distanceRynke: whole(rules.distanceStepRynke),
		elevationM: whole(rules.elevationStepM),
		elevationRynke: whole(rules.elevationStepRynke),
		teamTraining: whole(amounts.team_training.team),
		weekendDay: whole(amounts.training_weekend_day.team),
		technique: whole(amounts.technique_training.team),
		teamThreshold: whole(rules.teamThreshold),
		virtualShare: `${rules.maxVirtualShare.num}/${rules.maxVirtualShare.den}`,
		outside: whole(virtualShareRequired(rules)),
		trainingThreshold: whole(rules.trainingThreshold),
	};
}

function stepCard(
	i18n: I18n,
	rider: Rider,
	tour: TourId,
	index: number,
	page: string,
): TourHint {
	const steps = tourSteps(tour, rider);
	const step = steps[index] as TourStep;
	const last = index === steps.length - 1;
	const progress = i18n.t("tour.progress", {
		step: String(index + 1),
		total: String(steps.length),
	});
	return {
		section: step.target ? null : step.section,
		example: step.example === true,
		card: card(
			i18n,
			tour,
			page,
			step.target ?? null,
			html`<p class="tour-progress">${progress}</p>
<p>${i18n.t(step.text, ruleParams(i18n, CURRENT_RULES))}</p>`,
			last
				? html`<button class="button">${i18n.t("tour.done")}</button>`
				: html`<a class="button" href="${stepHref(tour, rider, index + 1)}">${i18n.t("tour.next")}</a>`,
		),
	};
}

/**
 * The hint itself: its text, then the way on and Skip. Both Skip and the last
 * step's button send the form, which marks the tour done. `data-target` names
 * the element the step points at, which the stylesheet highlights.
 */
function card(
	i18n: I18n,
	tour: TourId,
	page: string,
	target: TourTarget | null,
	text: SafeHtml,
	next: SafeHtml,
): SafeHtml {
	return html`<aside class="tour" aria-label="${i18n.t("tour.label")}"${target ? html` data-target="${target}"` : null}>
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
