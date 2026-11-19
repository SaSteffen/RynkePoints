/**
 * A request's body as text, or null when it is over `maxBytes`: refused on its
 * `Content-Length`, or else read only up to the limit, never all of it.
 */
export async function readBodyUpTo(
	request: Request,
	maxBytes: number,
): Promise<string | null> {
	const length = request.headers.get("Content-Length");
	if (length !== null && Number(length) > maxBytes) return null;
	if (!request.body) return "";
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let body = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			return null;
		}
		body += decoder.decode(value, { stream: true });
	}
	return body + decoder.decode();
}
