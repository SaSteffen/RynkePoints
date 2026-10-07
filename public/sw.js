// RynkePoints service worker (feature 010 contracts/client.md, research R2).
// Network only: every page comes from the server. The only cached responses are
// the offline notice and the notification text in the device's language, never
// a page or rider data (FR-005). The page registers it as `/sw.js?lang=<l>`, so
// switching the language installs it again with the new texts.

const param = new URL(location.href).searchParams.get("lang") ?? "";
const lang = /^[a-z]{2}$/.test(param) ? param : "de";
const CACHE = `rp-${lang}`;
const OFFLINE = `/offline?lang=${lang}`;
const TEXT = `/notification-text?lang=${lang}`;

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([OFFLINE, TEXT]);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name.startsWith("rp-") && name !== CACHE)
					.map((name) => caches.delete(name)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	if (event.request.mode !== "navigate") return;
	// The notice is stored with `Vary: Accept-Language, Cookie`; its URL already
	// holds the language, so it matches whatever the navigation sent.
	event.respondWith(
		fetch(event.request).catch(
			async () =>
				(await caches.match(OFFLINE, { ignoreVary: true })) ?? Response.error(),
		),
	);
});
