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
const RIDER_TEXT = `/me/notification-text?lang=${lang}`;

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

/**
 * What the signed-in rider still needs (issue #45), else the cached text, else
 * the server's, else the app name alone (FR-032).
 */
async function notificationText() {
	try {
		const response = await fetch(RIDER_TEXT, { cache: "no-store" });
		if (response.status === 200) return await response.json();
	} catch {
		// Offline or signed out on this device: the fixed text below.
	}
	try {
		const response =
			(await caches.match(TEXT, { ignoreVary: true })) ?? (await fetch(TEXT));
		if (!response.ok) throw new Error(`status ${response.status}`);
		return await response.json();
	} catch {
		return { title: "RynkePoints" };
	}
}

// The push has no body; the device asks the server what to show
// (contracts/push-delivery.md "What the device shows").
self.addEventListener("push", (event) => {
	event.waitUntil(
		(async () => {
			const text = await notificationText();
			await self.registration.showNotification(text.title, {
				body: text.body,
				tag: "new-rynke",
				renotify: true,
				icon: "/icons/icon-192.png",
				badge: "/icons/badge-96.png",
				data: { url: "/me" },
			});
		})(),
	);
});

// Opens the rider page in an open RynkePoints window, or a new one (FR-019).
self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(
		(async () => {
			const [open] = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			try {
				if (open) {
					await (await open.focus()).navigate("/me");
					return;
				}
			} catch {
				// A window this worker doesn't control can't be navigated.
			}
			await self.clients.openWindow("/me");
		})(),
	);
});
