export default {
	async fetch(request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/health") {
			return new Response("ok");
		}
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
