import type { Ctx } from "../../ctx";
import type { I18n } from "../../i18n/i18n";
import { html } from "../html";
import { PEOPLE } from "../icons";
import { shellPage } from "../shell";

// Team at `/team` (feature 011 FR-013): a placeholder until the team
// leaderboard fills it. It reads nothing beyond the viewer, so it can't show
// another rider's data.

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
		() => html`<section class="placeholder">
${PEOPLE}
<h2>${i18n.t("team.placeholder.heading")}</h2>
<p>${i18n.t("team.placeholder.body")}</p>
</section>`,
	);
}
