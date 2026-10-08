import type { Ctx } from "../../ctx";
import type { I18n } from "../../i18n/i18n";
import { coin } from "../coin";
import { html } from "../html";
import { shellPage } from "../shell";

// Team at `/team` (feature 011 FR-013): a placeholder until the team
// leaderboard fills it, under the coin's Hamburg–Paris side (feature 012
// FR-003). It reads nothing beyond the viewer, so it can't show another rider's
// data. Organisers also get the way to their pages (feature 014 FR-002, R2).

export function handleTeam(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return shellPage(
		request,
		ctx,
		i18n,
		"team",
		"/team",
		({ rider }) => html`<section class="placeholder">
${coin("back", "large")}
<h2>${i18n.t("team.placeholder.heading")}</h2>
<p>${i18n.t("team.placeholder.body")}</p>
</section>${
			rider.organiser
				? html`
<p class="organiser-entry"><a class="button-outlined" href="/organiser">${i18n.t("organiser.link")}</a></p>`
				: null
		}`,
	);
}
