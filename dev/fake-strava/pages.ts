import { html, SafeHtml } from "../../src/http/html";
import type { SampleRider } from "./samples";
import type { FakeActivity } from "./store";

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
	/** The rider's fake activities, newest first. */
	activities: readonly FakeActivity[];
}

const SPORT_TYPES = [
	"Ride",
	"GravelRide",
	"MountainBikeRide",
	"VirtualRide",
	"EBikeRide",
	"Run",
];

function rideChoice(activities: readonly FakeActivity[]): SafeHtml {
	const options = activities.map(
		(a) =>
			html`<option value="${a.id}">${a.id}: ${a.start_date_local.slice(0, 16).replace("T", " ")}, ${a.sport_type}, ${(a.distance / 1000).toFixed(1)} km${a.private ? ", private" : ""}</option>`,
	);
	return html`<select name="activityId">${options}</select>`;
}

/** Strava's events for one stored rider (contracts/dev-routes.md). */
function eventForms(
	rider: SampleRider,
	row: IndexRow,
	today: string,
): SafeHtml {
	const hidden = html`<input type="hidden" name="athleteId" value="${rider.athleteId}">`;
	const sports = SPORT_TYPES.map((s) => html`<option>${s}</option>`);
	const flag = (name: string) =>
		html`<label>${name} <select name="${name}"><option value="">unchanged</option><option value="true">yes</option><option value="false">no</option></select></label>`;
	const rides = row.activities.length > 0;
	return html`<details><summary>Strava events for ${rider.firstName}</summary>
<form method="post" action="/_dev/events"><fieldset><legend>New ride</legend>${hidden}<input type="hidden" name="action" value="create">
<label>Date <input type="date" name="date" value="${today}"></label>
<label>Time <input type="time" name="time" value="09:00"></label>
<label>Sport <select name="sportType">${sports}</select></label><br>
<label>km <input name="distanceKm" value="40" size="5"></label>
<label>m up <input name="elevationM" value="300" size="5"></label>
<label>moving min <input name="movingMin" value="90" size="4"></label>
<label>elapsed min <input name="elapsedMin" value="100" size="4"></label>
<label><input type="checkbox" name="private" value="true"> private</label>
<label><input type="checkbox" name="manual" value="true"> manual</label>
<button>Send create</button></fieldset></form>
${
	rides
		? html`<form method="post" action="/_dev/events"><fieldset><legend>Change a ride (empty = unchanged)</legend>${hidden}<input type="hidden" name="action" value="update">
${rideChoice(row.activities)}<br>
<label>Date <input type="date" name="date"></label>
<label>Time <input type="time" name="time"></label>
<label>Sport <select name="sportType"><option value="">unchanged</option>${sports}</select></label><br>
<label>km <input name="distanceKm" size="5"></label>
<label>m up <input name="elevationM" size="5"></label>
<label>moving min <input name="movingMin" size="4"></label>
<label>elapsed min <input name="elapsedMin" size="4"></label>
${flag("private")} ${flag("manual")}
<button>Send update</button></fieldset></form>
<form method="post" action="/_dev/events"><fieldset><legend>Delete a ride</legend>${hidden}<input type="hidden" name="action" value="delete">
${rideChoice(row.activities)} <button>Send delete</button></fieldset></form>`
		: null
}
<form method="post" action="/_dev/events">${hidden}<button name="action" value="deauthorize">Revoke access</button></form>
<form method="post" action="/_dev/events">${hidden}<button name="action" value="repeat">Send the last event again</button></form>
</details>`;
}

/** The `/_dev/` index. `today` (`YYYY-MM-DD`) fills the new-ride date. */
export function indexPage(
	rows: readonly IndexRow[],
	flash: string | null,
	today: string,
): Response {
	const lines = rows.map(
		(row) => html`<tr>
<td>${row.rider.firstName}<br><small>${row.rider.athleteId}</small></td>
<td>${row.rider.state}</td>
<td>${row.stored ? `${row.stored.status}, import ${row.stored.importStatus}` : "not stored"}</td>
<td><form method="post" action="/_dev/connect"><input type="hidden" name="athleteId" value="${row.rider.athleteId}"><button>Connect as</button></form></td>
</tr>
${
	row.stored
		? html`<tr><td colspan="4">${eventForms(row.rider, row, today)}</td></tr>
`
		: null
}`,
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
