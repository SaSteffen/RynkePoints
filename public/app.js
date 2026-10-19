// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker,
// the install group and the app prompt, the notifications switch, the scheme
// picker, reloading a section on return, waiting for the first data, the
// buttons' press and busy feedback, opening a badge's large view on mouse
// hover (feature 013 research R19) and the event page's tri-state boxes
// (feature 019 research R5). It holds no text: every word shown comes
// from the page's markup, rendered from the catalogs and hidden until this
// shows it.

/**
 * Resolves to whether the service worker is registered. Firefox's private
 * windows have `navigator.serviceWorker` but may refuse to register one, and
 * its `ready` then never resolves.
 */
function registerWorker() {
	if (!("serviceWorker" in navigator)) return Promise.resolve(false);
	const lang = encodeURIComponent(document.documentElement.lang);
	return navigator.serviceWorker
		.register(`/sw.js?lang=${lang}`, { scope: "/" })
		.then(
			() => true,
			() => false,
		);
}

function standalone() {
	return (
		matchMedia("(display-mode: standalone)").matches ||
		navigator.standalone === true
	);
}

/**
 * The browser's install prompt, kept by one listener so the Settings group and
 * the app prompt can both offer it (015 contracts/client.md).
 */
let installEvent = null;
const installable = [];
window.addEventListener("beforeinstallprompt", (event) => {
	event.preventDefault();
	installEvent = event;
	for (const callback of installable) callback();
});

/**
 * The steps to show where the browser has no install prompt of its own: Safari
 * on iOS, Firefox on Android and Safari 17+ on the Mac. Null elsewhere.
 */
function manualInstall() {
	// Only Safari on iOS defines it, and false means "not on the home screen".
	if (navigator.standalone === false) return "ios";
	const agent = navigator.userAgent;
	if (/Android/.test(agent) && /Firefox\//.test(agent)) return "firefox";
	const safari = agent.match(/Macintosh.*Version\/(\d+)[\d.]* Safari\//);
	if (
		safari &&
		Number(safari[1]) >= 17 &&
		!/Chrome|Chromium|Edg|Firefox|OPR/.test(agent)
	) {
		return "macSafari";
	}
	return null;
}

/** Shows the browser's install prompt once; the event can't be reused. */
function promptInstall() {
	installEvent?.prompt();
	installEvent = null;
}

/**
 * The App group in Settings (FR-004, 015 FR-011, research R11): it shows where
 * installing helps, has no dismiss, and ignores the app prompt's answers.
 */
function installSettings() {
	const hint = document.querySelector("#settings-app #install");
	if (!hint || standalone()) return;
	const group = hint.closest("section#settings-app");
	const setShown = (shown) => {
		hint.hidden = !shown;
		group.hidden = !shown;
	};
	const prompt = hint.querySelector('[data-install="prompt"]');
	const showPrompt = () => {
		prompt.hidden = false;
		setShown(true);
	};
	installable.push(showPrompt);
	if (installEvent) showPrompt();
	prompt.querySelector("button").addEventListener("click", () => {
		setShown(false);
		promptInstall();
	});

	const manual = manualInstall();
	if (manual) {
		hint.querySelector(`[data-install="${manual}"]`).hidden = false;
		setShown(true);
	}

	window.addEventListener("appinstalled", () => {
		setShown(false);
	});
}

function fromBase64Url(value) {
	const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Asks the server about, or changes, this device's registration. */
async function post(action, endpoint) {
	const body = new FormData();
	body.set("action", action);
	body.set("endpoint", endpoint);
	const response = await fetch("/me/notifications", {
		method: "POST",
		body,
		credentials: "same-origin",
	});
	if (response.status !== 200) throw new Error(`status ${response.status}`);
	return (await response.json()).on;
}

/** Signing out ends this device's notifications (research R9). */
function setSignOutEndpoint(endpoint) {
	for (const input of document.querySelectorAll("input[name=push_endpoint]")) {
		input.value = endpoint;
	}
}

/**
 * Turns notifications on for this device, from a tap: the Settings switch and
 * the app prompt's offer (015 FR-014, research R10). Resolves to the state to
 * show, "on", "off" or "blocked", and throws when it fails.
 */
async function subscribePush(pushKey) {
	// Asked inside the tap, before anything else (FR-010).
	const permission = await Notification.requestPermission();
	if (permission === "denied") return "blocked";
	if (permission !== "granted") return "off";
	const { pushManager } = await navigator.serviceWorker.ready;
	const subscription =
		(await pushManager.getSubscription()) ??
		(await pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: fromBase64Url(pushKey),
		}));
	await post("on", subscription.endpoint);
	setSignOutEndpoint(subscription.endpoint);
	return "on";
}

/** Tells the Settings switch that the app prompt changed this device. */
const PUSH_CHANGED = "rp-push-changed";

/**
 * The section in Settings (FR-010, FR-011, research R8's state table; feature
 * 011 contracts/client.md "Notifications switch").
 */
async function notifications() {
	const section = document.getElementById("notifications");
	if (!section) return;
	const toggle = section.querySelector('[data-action="toggle"]');
	/**
	 * Shows exactly one state. The switch shows for on, off and failed; failed
	 * keeps the value it had before the attempt.
	 */
	const show = (state, checked) => {
		for (const p of section.querySelectorAll("[data-state]")) {
			p.hidden = p.dataset.state !== state;
		}
		toggle.hidden = !["on", "off", "failed"].includes(state);
		if (checked !== undefined) toggle.setAttribute("aria-checked", checked);
		section.hidden = false;
	};

	if (
		!("serviceWorker" in navigator) ||
		!("PushManager" in window) ||
		!("Notification" in window)
	) {
		show("unsupported");
		return;
	}
	if (navigator.standalone === false) {
		show("needsHomeScreen");
		return;
	}
	if (!(await registered)) {
		show("unsupported");
		return;
	}
	let pushManager;
	let subscription;
	try {
		({ pushManager } = await navigator.serviceWorker.ready);
		subscription = await pushManager.getSubscription();
	} catch {
		show("unsupported");
		return;
	}
	if (subscription) setSignOutEndpoint(subscription.endpoint);

	const turnOn = async () => {
		try {
			const state = await subscribePush(section.dataset.pushKey);
			if (state === "on") {
				subscription = await pushManager.getSubscription();
				show("on", true);
			} else {
				show(state, state === "off" ? false : undefined);
			}
		} catch {
			show("failed");
		}
	};
	const turnOff = async () => {
		try {
			if (subscription) {
				const { endpoint } = subscription;
				await subscription.unsubscribe();
				subscription = null;
				setSignOutEndpoint("");
				await post("off", endpoint);
			}
			show("off", false);
		} catch {
			show("failed");
		}
	};
	// One change at a time: a second tap mid-way would subscribe twice.
	toggle.addEventListener("click", async () => {
		toggle.disabled = true;
		try {
			await (toggle.getAttribute("aria-checked") === "true"
				? turnOff()
				: turnOn());
		} finally {
			toggle.disabled = false;
		}
	});

	const sync = async () => {
		if (Notification.permission === "denied") {
			show("blocked");
		} else if (!subscription) {
			show("off", false);
		} else {
			try {
				// The server decides: sign-out or another rider may have ended it.
				const on = await post("check", subscription.endpoint);
				show(on ? "on" : "off", on);
			} catch {
				show("failed", false);
			}
		}
	};
	// The app prompt may turn them on while Settings is open (research R10).
	document.addEventListener(PUSH_CHANGED, async () => {
		subscription = await pushManager.getSubscription();
		if (subscription) setSignOutEndpoint(subscription.endpoint);
		await sync();
	});
	await sync();
}

/**
 * The floating prompt in the signed-in sections (015 FR-012–FR-016,
 * contracts/client.md, data-model.md "Prompt panel transitions"): once per
 * device it offers installing, then turning on notifications. One panel shows
 * at a time; nothing moves focus, and Escape closes it like the close button.
 */
function appPrompt() {
	const aside = document.getElementById("app-prompt");
	if (!aside) return;
	const INSTALL = "rp-install-prompt";
	const NOTIFY = "rp-notify-offer";
	const answered = {};
	try {
		// The old hint's dismissal is no answer to this prompt (research R9).
		localStorage.removeItem("rp-install-dismissed");
		answered[INSTALL] = localStorage.getItem(INSTALL) !== null;
		answered[NOTIFY] = localStorage.getItem(NOTIFY) !== null;
	} catch {
		return;
	}
	const answer = (key) => {
		answered[key] = true;
		try {
			localStorage.setItem(key, "done");
		} catch {}
	};
	const panels = {
		install: aside.querySelector('[data-panel="install"]'),
		notify: aside.querySelector('[data-panel="notify"]'),
	};
	const keys = { install: INSTALL, notify: NOTIFY };
	let shown = null;
	const show = (name) => {
		for (const [key, panel] of Object.entries(panels)) {
			panel.hidden = key !== name;
		}
		aside.hidden = name === null;
		shown = name;
	};
	const close = () => {
		if (shown === null) return;
		answer(keys[shown]);
		show(null);
	};

	const offerNotifications = async () => {
		if (
			shown !== null ||
			answered[NOTIFY] ||
			!("serviceWorker" in navigator) ||
			!("PushManager" in window) ||
			!("Notification" in window) ||
			Notification.permission !== "default" ||
			!(await registered)
		) {
			return;
		}
		const { pushManager } = await navigator.serviceWorker.ready;
		if (shown !== null || (await pushManager.getSubscription())) return;
		// The visible panel's first paragraph names the prompt.
		document.getElementById("app-prompt-title")?.removeAttribute("id");
		panels.notify.querySelector("p").id = "app-prompt-title";
		show("notify");
	};

	if (!standalone() && !answered[INSTALL]) {
		const showInstall = (way) => {
			if (shown !== null && shown !== "install") return;
			panels.install.querySelector(`[data-install="${way}"]`).hidden = false;
			show("install");
		};
		installable.push(() => showInstall("prompt"));
		if (installEvent) showInstall("prompt");
		const manual = manualInstall();
		if (manual) showInstall(manual);
		panels.install
			.querySelector('[data-install="prompt"] button')
			.addEventListener("click", () => {
				answer(INSTALL);
				show(null);
				promptInstall();
			});
	}
	window.addEventListener("appinstalled", () => {
		answer(INSTALL);
		if (shown === "install") show(null);
		offerNotifications().catch(() => {});
	});

	const accept = panels.notify.querySelector('[data-action="accept"]');
	accept.addEventListener("click", async () => {
		accept.disabled = true;
		try {
			await subscribePush(aside.dataset.pushKey);
		} catch {
			// Settings still offers the switch, with its own error state.
		}
		answer(NOTIFY);
		show(null);
		document.dispatchEvent(new Event(PUSH_CHANGED));
	});
	panels.notify
		.querySelector('[data-action="decline"]')
		.addEventListener("click", close);
	aside.querySelector('[data-action="close"]').addEventListener("click", close);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") close();
	});

	if (standalone()) offerNotifications().catch(() => {});
}

/** The `surface` colour of each scheme, as in the head script (research R12). */
const THEME_COLOR = { light: "#fffdf5", dark: "#12110c" };

/**
 * The Appearance group in Settings (FR-032a): System, Light or Dark for this
 * device only. It applies the choice the way the head script does on load.
 */
function schemePicker() {
	const radios = document.querySelectorAll("input[name=scheme]");
	if (radios.length === 0) return;
	const KEY = "rp-scheme";
	let stored = null;
	try {
		stored = localStorage.getItem(KEY);
	} catch {}
	const current = stored === "light" || stored === "dark" ? stored : "system";
	for (const radio of radios) {
		radio.checked = radio.value === current;
		radio.addEventListener("change", () => {
			const scheme = radio.value;
			try {
				if (scheme === "system") localStorage.removeItem(KEY);
				else localStorage.setItem(KEY, scheme);
			} catch {}
			const metas = document.querySelectorAll('meta[name="theme-color"]');
			if (scheme === "system") {
				delete document.documentElement.dataset.scheme;
				// Back to one colour per system setting, as the page is served.
				for (const [i, m] of [...metas].entries()) {
					const s = i === 0 ? "light" : "dark";
					m.media = `(prefers-color-scheme: ${s})`;
					m.content = THEME_COLOR[s];
				}
			} else {
				document.documentElement.dataset.scheme = scheme;
				for (const m of metas) {
					m.removeAttribute("media");
					m.content = THEME_COLOR[scheme];
				}
			}
		});
	}
}

/** How long the next page may take before the progress bar shows (issue #108). */
const LOADING_DELAY_MS = 1000;
let loadingTimer = null;

/**
 * Shows the page's progress bar if the next page isn't there within a second
 * (issue #108). Every page is a full round trip to the server, and until it
 * answers the browser keeps showing this one as if nothing happened.
 */
function startLoading() {
	const bar = document.querySelector(".page-loading");
	if (!bar || loadingTimer !== null) return;
	loadingTimer = setTimeout(() => {
		bar.hidden = false;
	}, LOADING_DELAY_MS);
}

function stopLoading() {
	clearTimeout(loadingTimer);
	loadingTimer = null;
	const bar = document.querySelector(".page-loading");
	if (bar) bar.hidden = true;
}

/**
 * Starts the progress bar for whatever leaves this page for another of ours: a
 * link, the top bar's refresh, a form. Links to another site, a new tab, a
 * download or a file don't count: this page stays. A page restored from the
 * back-forward cache, or left for another app (Strava's, say), starts without
 * it.
 */
function pageLoading() {
	document.addEventListener("click", (event) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const link =
			event.target instanceof Element ? event.target.closest("a[href]") : null;
		if (
			!(link instanceof HTMLAnchorElement) ||
			link.hasAttribute("download") ||
			(link.target !== "" && link.target !== "_self")
		) {
			return;
		}
		const url = new URL(link.href);
		const samePage =
			url.pathname === location.pathname && url.search === location.search;
		if (
			url.origin !== location.origin ||
			(samePage && url.hash !== "") ||
			/\.[a-z0-9]+$/i.test(url.pathname)
		) {
			return;
		}
		startLoading();
	});
	document.addEventListener("submit", (event) => {
		if (!event.defaultPrevented) startLoading();
	});
	window.addEventListener("pageshow", stopLoading);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") stopLoading();
	});
}

/**
 * A section brought back after more than a minute in the background reloads,
 * so its figures are current (feature 011 FR-009, research R8). Public pages
 * have no `nav.app-nav` and keep what the rider typed.
 */
function refreshOnReturn() {
	let hiddenAt = null;
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			hiddenAt = Date.now();
		} else if (
			hiddenAt !== null &&
			Date.now() - hiddenAt > 60000 &&
			document.querySelector("nav.app-nav")
		) {
			startLoading();
			location.reload();
		}
	});
}

/**
 * The waiting state before the first data (015 contracts/client.md): asks
 * /me/ready every data-poll-seconds while the page is visible, and reloads once
 * the first balance is there. A 401, a network error or "not yet" just waits
 * for the next tick.
 */
function waitForFirstData() {
	const waiting = document.querySelector("[data-waiting]");
	if (!waiting) return;
	const configured = Number(waiting.dataset.pollSeconds);
	const seconds =
		Number.isInteger(configured) && configured > 0 ? configured : 10;
	const timer = setInterval(async () => {
		if (document.visibilityState !== "visible") return;
		try {
			const res = await fetch("/me/ready", {
				credentials: "same-origin",
				cache: "no-store",
			});
			if (!res.ok) return;
			const { ready } = await res.json();
			if (ready === true) {
				clearInterval(timer);
				startLoading();
				location.reload();
			}
		} catch {
			// Offline or a bad answer: try again on the next tick.
		}
	}, seconds * 1000);
}

/** Where a `data-keep-scroll` link left the page (issue #113). */
const KEEP_SCROLL = "rp-keep-scroll";

/**
 * Links that show the same page in another view, like the Team section's
 * switches, open the next page where this one was instead of at the top
 * (issue #113). The position goes to session storage on the tap and is used
 * once, only by the page the link went to.
 */
function keepScroll() {
	try {
		const kept = sessionStorage.getItem(KEEP_SCROLL);
		sessionStorage.removeItem(KEEP_SCROLL);
		if (kept !== null) {
			const { url, y } = JSON.parse(kept);
			if (url === location.pathname + location.search && Number.isFinite(y)) {
				scrollTo(0, y);
			}
		}
	} catch {
		// No storage, or a bad entry: the page opens at the top.
	}
	document.addEventListener("click", (event) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const link =
			event.target instanceof Element
				? event.target.closest("a[href][data-keep-scroll]")
				: null;
		if (!(link instanceof HTMLAnchorElement)) return;
		const url = new URL(link.href);
		if (url.origin !== location.origin) return;
		try {
			sessionStorage.setItem(
				KEEP_SCROLL,
				JSON.stringify({ url: url.pathname + url.search, y: scrollY }),
			);
		} catch {}
	});
}

/** Where Rides keeps its place in this tab (feature 018 research R5). */
const RIDES_PLACE = "rp-rides-place";

/** The most rides one request may bring back (018 contracts/http-routes.md). */
const MAX_RIDE_BATCH = 1000;

/**
 * Rides as one continuous list (feature 018 contracts/client.md): the next
 * rides load as the end of the list comes within a screen, the season's total
 * replaces the pager and the page count, and a reload or the back button finds
 * the same ride in view. Without IntersectionObserver the pager stays.
 */
function lazyRides() {
	const section = document.querySelector("section#rides[data-lazy]");
	const list = section?.querySelector("ol.ride-list");
	const more = section?.querySelector(".rides-more");
	const status = more?.querySelector(".rides-status");
	const retry = more?.querySelector("[data-retry]");
	if (!list || !status || !retry) return;
	if (typeof IntersectionObserver !== "function") return;
	for (const old of section.querySelectorAll("nav.pager, .rides-position")) {
		old.hidden = true;
	}
	for (const line of section.querySelectorAll(".rides-total, .rides-newest")) {
		line.hidden = false;
	}
	try {
		history.scrollRestoration = "manual";
	} catch {}

	const cards = () => Array.from(list.querySelectorAll("li.ride-card"));
	/** A card's ride, from its "View on Strava" link. */
	const rideOf = (card) => {
		const link = card.querySelector("a.strava-activity");
		return link?.href.match(/\/(\d+)$/)?.[1] ?? null;
	};
	const setState = (state) => {
		if (state) more.dataset.state = state;
		else more.removeAttribute("data-state");
		const text = state ? status.dataset[state] : "";
		status.textContent = text ?? "";
		retry.hidden = state !== "failed";
	};

	let busy = false;
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) load();
		},
		{ rootMargin: "0px 0px 100% 0px" },
	);
	/** Observing afresh reports whether the end is still in reach. */
	const watch = () => {
		observer.unobserve(more);
		if (list.dataset.more) observer.observe(more);
	};

	/** Appends the next batch, or `limit` rides; `false` once it reloads. */
	async function load(limit) {
		const url = list.dataset.more;
		if (busy || !url) return true;
		busy = true;
		setState("loading");
		list.setAttribute("aria-busy", "true");
		try {
			const res = await fetch(limit ? `${url}&limit=${limit}` : url, {
				credentials: "same-origin",
				cache: "no-store",
			});
			// Signed out, the consent gate or the waiting state: the page shows it.
			if ([401, 403, 409].includes(res.status)) {
				startLoading();
				location.reload();
				return false;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const parser = new DOMParser();
			const doc = parser.parseFromString(await res.text(), "text/html");
			const batch = doc.querySelector("ol.ride-list");
			if (!batch) throw new Error("no ride list");
			const next = batch.dataset.more;
			list.append(...batch.children);
			if (next) list.dataset.more = next;
			else list.removeAttribute("data-more");
			setState("added");
		} catch {
			// Offline or a bad answer: retry, back online or at the end again.
			setState("failed");
			return true;
		} finally {
			busy = false;
			list.removeAttribute("aria-busy");
		}
		if (list.dataset.more) {
			watch();
		} else {
			observer.disconnect();
			more.hidden = true;
		}
		return true;
	}

	retry.addEventListener("click", () => load());
	addEventListener("online", () => {
		if (more.dataset.state === "failed") load();
	});

	addEventListener("pagehide", () => {
		const bar = document.querySelector("header.top-bar");
		const top = bar ? bar.getBoundingClientRect().bottom : 0;
		const all = cards();
		const anchor = all.find(
			(card) => card.getBoundingClientRect().bottom > top,
		);
		try {
			sessionStorage.setItem(
				RIDES_PLACE,
				JSON.stringify({
					url: location.pathname + location.search,
					loaded: all.length,
					anchor: anchor ? rideOf(anchor) : null,
					offset: anchor ? anchor.getBoundingClientRect().top : 0,
					y: scrollY,
				}),
			);
		} catch {}
	});

	/** After a reload or the back button: the rides and the ride in view. */
	async function restore() {
		let place = null;
		try {
			place = JSON.parse(sessionStorage.getItem(RIDES_PLACE) ?? "null");
			sessionStorage.removeItem(RIDES_PLACE);
		} catch {
			return true;
		}
		const type = performance.getEntriesByType?.("navigation")[0]?.type;
		if (!place || place.url !== location.pathname + location.search) {
			return true;
		}
		if (type !== "reload" && type !== "back_forward") return true;
		const missing = Number(place.loaded) - cards().length;
		if (Number.isInteger(missing) && missing > 0) {
			if (!(await load(Math.min(missing, MAX_RIDE_BATCH)))) return false;
		}
		const anchor = cards().find((card) => rideOf(card) === place.anchor);
		if (anchor) {
			const offset = Number(place.offset) || 0;
			scrollTo(0, anchor.getBoundingClientRect().top + scrollY - offset);
		} else if (Number.isFinite(place.y)) {
			scrollTo(0, place.y);
		}
		return true;
	}

	more.hidden = !list.dataset.more;
	restore().then((going) => {
		if (going) watch();
	});
}

/** The Material buttons that show press feedback (issue #107). */
const PRESSABLE =
	".button,.button-outlined,.button-text,.danger,.segmented,.segmented-group label,.icon-button";

/**
 * A ripple from the point of the tap on a Material button (issue #107). Without
 * it, or with reduced motion, the stylesheet's flat pressed layer shows instead:
 * the `ripples` class on the root switches that layer off.
 */
function pressFeedback() {
	// Safari on iOS applies :active on touch only once a touch listener exists.
	document.addEventListener("touchstart", () => {}, { passive: true });
	if (
		matchMedia("(prefers-reduced-motion: reduce)").matches ||
		typeof Element.prototype.animate !== "function"
	) {
		return;
	}
	document.documentElement.classList.add("ripples");
	document.addEventListener("pointerdown", (event) => {
		if (!event.isPrimary || event.button !== 0) return;
		const target =
			event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
		if (!target || target.getAttribute("aria-busy") === "true") return;
		const box = target.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;
		const radius = Math.hypot(
			Math.max(x, box.width - x),
			Math.max(y, box.height - y),
		);
		const ripple = document.createElement("span");
		ripple.className = "ripple";
		ripple.setAttribute("aria-hidden", "true");
		ripple.style.left = `${x - radius}px`;
		ripple.style.top = `${y - radius}px`;
		ripple.style.width = ripple.style.height = `${radius * 2}px`;
		target.append(ripple);
		const grow = ripple.animate(
			[{ transform: "scale(0)" }, { transform: "scale(1)" }],
			{ duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
		);
		const ends = ["pointerup", "pointercancel", "pointerleave"];
		const release = () => {
			for (const type of ends) target.removeEventListener(type, release);
			grow.finished
				.then(
					() =>
						ripple.animate([{ opacity: 0 }], {
							duration: 150,
							fill: "forwards",
						}).finished,
				)
				.catch(() => {})
				.finally(() => ripple.remove());
		};
		for (const type of ends) target.addEventListener(type, release);
	});
}

/**
 * Marks the button that sent a form as busy until the next page arrives, and
 * ignores a second submit meanwhile (issue #107). The button stays enabled: a
 * disabled submitter drops its name and value from the form data, which the
 * language buttons need. A page restored from the back-forward cache starts
 * idle again.
 */
function pendingSubmit() {
	document.addEventListener("submit", (event) => {
		const form = event.target;
		if (event.defaultPrevented || !(form instanceof HTMLFormElement)) return;
		if (form.dataset.submitting === "true") {
			event.preventDefault();
			return;
		}
		form.dataset.submitting = "true";
		const button =
			event.submitter ?? form.querySelector("button:not([type=button])");
		button?.setAttribute("aria-busy", "true");
	});
	window.addEventListener("pageshow", (event) => {
		if (!event.persisted) return;
		for (const form of document.querySelectorAll("form[data-submitting]")) {
			delete form.dataset.submitting;
		}
		for (const button of document.querySelectorAll("[aria-busy=true]")) {
			button.removeAttribute("aria-busy");
		}
	});
}

/**
 * A badge's large view also opens while a mouse rests on the badge (feature
 * 013 research R19); tap, click and keyboard stay the popover's own. A click
 * on a badge the hover opened keeps it open instead of toggling it shut.
 */
function badgeHover() {
	if (!("showPopover" in HTMLElement.prototype)) return;
	for (const button of document.querySelectorAll(
		"button.badge[popovertarget]",
	)) {
		const large = document.getElementById(button.getAttribute("popovertarget"));
		if (!large) continue;
		// While hover holds the large view open it floats beside the mouse
		// and follows it, lets the pointer through to the badge, and hides
		// its close button: leaving the badge closes it.
		let byHover = false;
		const hover = (on) => {
			byHover = on;
			large.classList.toggle("badge-large-hover", on);
			if (!on) large.style.removeProperty("left");
			if (!on) large.style.removeProperty("top");
		};
		const follow = (event) => {
			if (event.pointerType !== "mouse" || !byHover) return;
			const gap = 16;
			const { width, height } = large.getBoundingClientRect();
			let left = event.clientX + gap;
			if (left + width > innerWidth - gap) left = event.clientX - gap - width;
			let top = event.clientY + gap;
			if (top + height > innerHeight - gap) top = innerHeight - gap - height;
			large.style.left = `${Math.max(gap, left)}px`;
			large.style.top = `${Math.max(gap, top)}px`;
		};
		button.addEventListener("pointerenter", (event) => {
			if (event.pointerType !== "mouse" || large.matches(":popover-open"))
				return;
			hover(true);
			large.showPopover();
			follow(event);
		});
		button.addEventListener("pointermove", follow);
		button.addEventListener("pointerleave", (event) => {
			if (event.pointerType !== "mouse" || !byHover) return;
			hover(false);
			if (large.matches(":popover-open")) large.hidePopover();
		});
		large.addEventListener("toggle", (event) => {
			if (event.newState === "closed") hover(false);
		});
		button.addEventListener("click", (event) => {
			if (!byHover) return;
			hover(false);
			event.preventDefault();
		});
	}
}

/**
 * The event page's open requests (feature 019 research R5): each rider's three
 * radios become one box that cycles grey, ticked, empty and grey again, and
 * the tag beside it says what saving will do. The radios stay the form's
 * fields, so saving works the same without this script.
 */
function triState() {
	const form = document.querySelector("form.attendance-form");
	if (!form) return;
	const sets = [...form.querySelectorAll("fieldset.tri-state")];
	if (sets.length === 0) return;
	const order = ["open", "yes", "no"];
	const checked = { open: "mixed", yes: "true", no: "false" };
	const stateOf = (set) => set.querySelector("input:checked")?.value ?? "open";
	const summary = form.querySelector(".tri-summary");
	const update = () => {
		if (!summary) return;
		const counts = { open: 0, yes: 0, no: 0 };
		for (const set of sets) counts[stateOf(set)] += 1;
		summary.textContent = summary.dataset.text
			.replace("{yes}", counts.yes)
			.replace("{no}", counts.no)
			.replace("{open}", counts.open);
		summary.hidden = false;
	};
	const show = (set) => {
		const value = stateOf(set);
		for (const tag of set.parentElement.querySelectorAll(".tri-tag")) {
			tag.hidden = !tag.classList.contains(`tri-tag-${value}`);
		}
		const toggle = set.querySelector(".tri-toggle");
		toggle.setAttribute("aria-checked", checked[value]);
		toggle.dataset.state = value;
	};
	const choose = (set, value) => {
		const radio = set.querySelector(`input[value="${value}"]`);
		if (radio) radio.checked = true;
		show(set);
		update();
	};
	for (const set of sets) {
		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "tri-toggle";
		toggle.setAttribute("role", "checkbox");
		const box = document.createElement("span");
		box.className = "tri-box";
		box.setAttribute("aria-hidden", "true");
		toggle.append(
			box,
			...set.querySelector("legend").cloneNode(true).childNodes,
		);
		toggle.addEventListener("click", () => {
			const next = order[(order.indexOf(stateOf(set)) + 1) % order.length];
			choose(set, next);
		});
		set.classList.add("tri-enhanced");
		set.prepend(toggle);
		show(set);
	}
	const all = form.querySelector(".confirm-all");
	if (all) {
		all.hidden = false;
		all.addEventListener("click", () => {
			for (const set of sets) {
				if (stateOf(set) === "open") choose(set, "yes");
			}
		});
	}
	update();
}

/**
 * The badges page's switch (feature 013 Part I): "Deine" and "Team" link to
 * their groups, and the one whose group fills the screen below the switch is
 * marked while scrolling either way; at the bottom of the page the last
 * group, however short. Filtering changes the heights, so it is marked again
 * then.
 */
function badgeSwitch() {
	const bar = document.querySelector(".badges-switch");
	const links = bar
		? [...bar.querySelectorAll('nav a.segmented[href^="#"]')]
		: [];
	const groups = links.map((link) =>
		document.getElementById(link.hash.slice(1)),
	);
	if (links.length === 0 || groups.includes(null)) return;
	let frame = 0;
	const mark = () => {
		frame = 0;
		// A group counts once its top is in the upper third below the switch.
		const below = bar.getBoundingClientRect().bottom;
		const line = below + (innerHeight - below) / 3;
		let current = 0;
		groups.forEach((group, i) => {
			if (group.getBoundingClientRect().top <= line) current = i;
		});
		const bottom = document.documentElement.scrollHeight - innerHeight - 2;
		if (scrollY > 0 && scrollY >= bottom) current = groups.length - 1;
		links.forEach((link, i) => {
			if (i === current) link.setAttribute("aria-current", "true");
			else link.removeAttribute("aria-current");
		});
	};
	const soon = () => {
		if (!frame) frame = requestAnimationFrame(mark);
	};
	addEventListener("scroll", soon, { passive: true });
	addEventListener("resize", soon);
	bar.addEventListener("change", soon);
	mark();
}

/**
 * The badges page opens on the card of the first new badge, the rider's own
 * before the team's, as the reveal names it (feature 013 Part I), in the
 * middle of the screen, below the sticky switch.
 */
function scrollToNewBadge() {
	const category = document.querySelector(".badges-reveal[data-scroll-to]")
		?.dataset.scrollTo;
	if (!category) return;
	document
		.querySelector(`.badge-card[data-category="${CSS.escape(category)}"]`)
		?.scrollIntoView({ block: "center" });
}

const registered = registerWorker();
keepScroll();
lazyRides();
pressFeedback();
pendingSubmit();
installSettings();
appPrompt();
schemePicker();
refreshOnReturn();
waitForFirstData();
pageLoading();
badgeHover();
triState();
scrollToNewBadge();
badgeSwitch();
notifications().catch(() => {});
