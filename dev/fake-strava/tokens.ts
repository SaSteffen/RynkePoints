// Stateless OAuth values of the fake Strava (specs/006-local-frontend-dev
// data-model.md "Stateless OAuth values"). Codes and tokens carry the athlete,
// the granted scopes and, for access tokens, the expiry, so nothing is lost when
// `wrangler dev` reloads the isolate. Synthetic, and only valid against the fake.

/** Access tokens last 6 hours, like Strava's. */
export const ACCESS_LIFETIME = 6 * 3600;

export interface Grant {
	athleteId: number;
	scopes: string[];
}

export interface AccessGrant extends Grant {
	/** Epoch seconds. */
	expiresAt: number;
}

function encodeScopes(scopes: readonly string[]): string {
	return encodeURIComponent(scopes.join(","));
}

/** The comma-separated scopes, or null if they aren't URL-encoded properly. */
function decodeScopes(value: string): string[] | null {
	try {
		const scopes = decodeURIComponent(value);
		return scopes === "" ? [] : scopes.split(",");
	} catch {
		return null;
	}
}

/** `<prefix>.<athleteId>.<scopes>[.<expiresAt>]`, split; null if malformed. */
function parts(value: string, prefix: string, count: number): string[] | null {
	const split = value.split(".");
	if (split.length !== count || split[0] !== prefix) return null;
	if (!split.slice(1).every((p, i) => i === 1 || /^\d+$/.test(p))) return null;
	return split.slice(1);
}

function grantOf([id, scopes]: string[]): Grant | null {
	const decoded = scopes === undefined ? null : decodeScopes(scopes);
	return decoded === null ? null : { athleteId: Number(id), scopes: decoded };
}

export function encodeCode({ athleteId, scopes }: Grant): string {
	return `fake-code.${athleteId}.${encodeScopes(scopes)}`;
}

export function decodeCode(code: string): Grant | null {
	const p = parts(code, "fake-code", 3);
	return p && grantOf(p);
}

export function encodeAccess({
	athleteId,
	scopes,
	expiresAt,
}: AccessGrant): string {
	return `fake-access.${athleteId}.${encodeScopes(scopes)}.${expiresAt}`;
}

export function decodeAccess(token: string): AccessGrant | null {
	const p = parts(token, "fake-access", 4);
	const grant = p && grantOf(p);
	if (!p || !grant) return null;
	return { ...grant, expiresAt: Number(p[2]) };
}

export function encodeRefresh({ athleteId, scopes }: Grant): string {
	return `fake-refresh.${athleteId}.${encodeScopes(scopes)}`;
}

export function decodeRefresh(token: string): Grant | null {
	const p = parts(token, "fake-refresh", 3);
	return p && grantOf(p);
}

/** The token of an `Authorization: Bearer …` header, or null. */
export function bearer(request: Request): string | null {
	const match = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/);
	return match?.[1] ?? null;
}
