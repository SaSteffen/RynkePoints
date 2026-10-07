import { html, SafeHtml } from "../../src/http/html";
import type { SampleRider } from "./samples";

// The fake mode's own pages (specs/006-local-frontend-dev contracts/dev-routes.md,
// research R11): the `/_dev/` index and the stand-in for Strava's permission
// screen. Developer tooling in plain English, never shown to riders, so not in
// the catalogs. Every value goes through `html`, which escapes it.

const STYLE = `body{font-family:system-ui,sans-serif;max-width:52rem;margin:0 auto;padding:1rem;line-height:1.4;color:#222}
.banner{background:#fff4ec;border-left:.25rem solid #fc5200;padding:.25rem 1rem}
table{border-collapse:collapse;width:100%}
td,th{border-top:1px solid #ddd;padding:.3rem .4rem;text-align:left;vertical-align:top}
form{display:inline}
fieldset{margin:1rem 0}`;

function page(title: string, body: SafeHtml): Response {
	const doc = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${new SafeHtml(STYLE)}</style>
</head>
<body>
<p class="banner">Fake mode: a stand-in for Strava with synthetic sample riders. No request leaves this machine.</p>
${body}
</body>
</html>
`;
	return new Response(doc.value, {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

/** The stand-in permission screen, `GET /_dev/strava/oauth/authorize`. */
export function authorizePage(
	query: URLSearchParams,
	riders: readonly SampleRider[],
): Response {
	const preselected = query.get("athlete");
	const scopes = (query.get("scope") ?? "").split(",").filter(Boolean);
	const options = riders.map(
		(r) =>
			html`<option value="${r.athleteId}"${String(r.athleteId) === preselected ? html` selected` : null}>${r.firstName} (${r.athleteId}): ${r.state}</option>`,
	);
	const boxes = scopes.map(
		(s) =>
			html`<label><input type="checkbox" name="scope" value="${s}" checked> ${s}</label><br>`,
	);
	return page(
		"Authorize (fake Strava)",
		html`<h1>Authorize (fake Strava)</h1>
<p>Sign in as a sample rider and choose what to grant, as on Strava's screen.</p>
<form method="post" action="/_dev/strava/oauth/authorize">
<input type="hidden" name="redirect_uri" value="${query.get("redirect_uri") ?? ""}">
<input type="hidden" name="state" value="${query.get("state") ?? ""}">
<p><label>Sample rider <select name="athlete">${options}</select></label></p>
<fieldset><legend>Scopes</legend>${boxes}</fieldset>
<button name="action" value="authorize">Authorize</button>
<button name="action" value="cancel">Cancel</button>
</form>`,
	);
}

export interface IndexRow {
	rider: SampleRider;
	/** The app's stored status, or null when the rider isn't stored. */
	stored: { status: string; importStatus: string } | null;
}

/** The `/_dev/` index. */
export function indexPage(
	rows: readonly IndexRow[],
	flash: string | null,
): Response {
	const lines = rows.map(
		({ rider, stored }) => html`<tr>
<td>${rider.firstName}<br><small>${rider.athleteId}</small></td>
<td>${rider.state}</td>
<td>${stored ? `${stored.status}, import ${stored.importStatus}` : "not stored"}</td>
<td><form method="post" action="/_dev/connect"><input type="hidden" name="athleteId" value="${rider.athleteId}"><button>Connect as</button></form></td>
</tr>
`,
	);
	return page(
		"Fake mode",
		html`<h1>Fake mode</h1>
${flash ? html`<p role="status"><strong>${flash}</strong></p>` : null}
<p><a href="/me">/me</a> · <a href="/__scheduled">run the daily cron (/__scheduled)</a></p>
<table>
<thead><tr><th>Sample rider</th><th>State</th><th>Stored</th><th></th></tr></thead>
<tbody>
${lines}</tbody>
</table>
<form method="post" action="/_dev/reset"><p><button>Reset sample data</button> Deletes every rider and seeds the sample data again.</p></form>`,
	);
}
