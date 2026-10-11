// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker,
// the install group and the app prompt, the notifications switch, the scheme
// picker, reloading a section on return, waiting for the first data, the
// buttons' press and busy feedback and opening a badge's large view on mouse
// hover (feature 013 research R19). It holds no text: every word shown comes
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

/** The Material buttons that show press feedback (issue #107). */
const PRESSABLE =
	".button,.button-outlined,.danger,.segmented,.segmented-group label,.icon-button";

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
		let byHover = false;
		button.addEventListener("pointerenter", (event) => {
			if (event.pointerType !== "mouse" || large.matches(":popover-open"))
				return;
			large.showPopover();
			byHover = true;
		});
		button.addEventListener("pointerleave", (event) => {
			if (event.pointerType !== "mouse" || !byHover) return;
			byHover = false;
			if (large.matches(":popover-open")) large.hidePopover();
		});
		button.addEventListener("click", (event) => {
			if (!byHover) return;
			byHover = false;
			event.preventDefault();
		});
	}
}

const registered = registerWorker();
keepScroll();
pressFeedback();
pendingSubmit();
installSettings();
appPrompt();
schemePicker();
refreshOnReturn();
waitForFirstData();
pageLoading();
badgeHover();
notifications().catch(() => {});
