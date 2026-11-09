import { secretEquals } from "../../crypto/secret";
import type { Ctx } from "../../ctx";
import type { I18n } from "../../i18n/i18n";
import { utcDay } from "../../usage/allowances";
import { exchangeToken, exportSince, ownCounts } from "../../usage/peers";
import { notFound } from "../errors";

// `GET /admin/usage/export` (feature 026 contracts/usage-exchange.md): this
// team's own counts per exchanged allowance and day, for the other teams' admin
// views. Only with the exchange token; anything else gets the unknown-address
// page, like /admin/run-daily. Counts only: no rider identifiers (FR-039).

const BEARER = /^Bearer (.+)$/;

export async function handleUsageExport(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	path: string,
): Promise<Response> {
	const expected = exchangeToken(ctx.env);
	const given = request.headers.get("Authorization")?.match(BEARER)?.[1];
	if (
		request.method !== "GET" ||
		expected === null ||
		given === undefined ||
		!(await secretEquals(given, expected))
	) {
		return notFound(i18n, path);
	}
	const today = utcDay(ctx.now());
	const since = exportSince(
		new URL(request.url).searchParams.get("since"),
		today,
	);
	return Response.json(await ownCounts(ctx, since), {
		headers: { "Cache-Control": "no-store" },
	});
}
