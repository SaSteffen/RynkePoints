// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker,
// the install prompt, the notifications switch, the scheme picker and reloading
// a section on return. It holds no text: every word shown comes from the page's markup,
// rendered from the catalogs and hidden until this shows it.

function registerWorker() {
	if (!("serviceWorker" in navigator)) return;
	const lang = encodeURIComponent(document.documentElement.lang);
	navigator.serviceWorker
		.register(`/sw.js?lang=${lang}`, { scope: "/" })
		.catch(() => {});
}

/**
 * The hint on `/`, Overview and Settings (FR-004, research R11). In Settings
 * its App group shows and hides with it (feature 011 contracts/client.md).
 */
function installHint() {
	const hint = document.getElementById("install");
	const DISMISSED = "rp-install-dismissed";
	const standalone =
		matchMedia("(display-mode: standalone)").matches ||
		navigator.standalone === true;
	if (!hint || standalone || localStorage.getItem(DISMISSED)) return;

	const group = hint.closest("section#settings-app");
	const setShown = (shown) => {
		hint.hidden = !shown;
		if (group) group.hidden = !shown;
	};
	const prompt = hint.querySelector('[data-install="prompt"]');
	let deferred = null;
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferred = event;
		prompt.hidden = false;
		setShown(true);
	});
	prompt.querySelector("button").addEventListener("click", () => {
		setShown(false);
		deferred?.prompt();
		deferred = null;
	});

	// Only Safari on iOS defines it, and false means "not on the home screen".
	if (navigator.standalone === false) {
		hint.querySelector('[data-install="ios"]').hidden = false;
		setShown(true);
	}

	window.addEventListener("appinstalled", () => {
		setShown(false);
	});
	hint
		.querySelector('[data-install="dismiss"]')
		.addEventListener("click", () => {
			localStorage.setItem(DISMISSED, "1");
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
	const { pushManager } = await navigator.serviceWorker.ready;
	let subscription = await pushManager.getSubscription();
	if (subscription) setSignOutEndpoint(subscription.endpoint);

	const turnOn = async () => {
		try {
			// Asked inside the tap, before anything else (FR-010).
			const permission = await Notification.requestPermission();
			if (permission === "denied") return show("blocked");
			if (permission !== "granted") return show("off", false);
			subscription ??= await pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: fromBase64Url(section.dataset.pushKey),
			});
			await post("on", subscription.endpoint);
			setSignOutEndpoint(subscription.endpoint);
			show("on", true);
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
			location.reload();
		}
	});
}

registerWorker();
installHint();
schemePicker();
refreshOnReturn();
notifications().catch(() => {});
