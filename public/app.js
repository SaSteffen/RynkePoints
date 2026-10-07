// RynkePoints page script (feature 010 contracts/client.md, research R16). It
// only wires up what a server-rendered page can't do itself: the service worker,
// the install prompt and the notifications switch. It holds no text: every word shown comes from the
// page's markup, rendered from the catalogs and hidden until this shows it.

function registerWorker() {
	if (!("serviceWorker" in navigator)) return;
	const lang = encodeURIComponent(document.documentElement.lang);
	navigator.serviceWorker
		.register(`/sw.js?lang=${lang}`, { scope: "/" })
		.catch(() => {});
}

/** The hint on `/` and `/me` (FR-004, research R11). */
function installHint() {
	const hint = document.getElementById("install");
	const DISMISSED = "rp-install-dismissed";
	const standalone =
		matchMedia("(display-mode: standalone)").matches ||
		navigator.standalone === true;
	if (!hint || standalone || localStorage.getItem(DISMISSED)) return;

	const prompt = hint.querySelector('[data-install="prompt"]');
	let deferred = null;
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferred = event;
		prompt.hidden = false;
		hint.hidden = false;
	});
	prompt.querySelector("button").addEventListener("click", () => {
		hint.hidden = true;
		deferred?.prompt();
		deferred = null;
	});

	// Only Safari on iOS defines it, and false means "not on the home screen".
	if (navigator.standalone === false) {
		hint.querySelector('[data-install="ios"]').hidden = false;
		hint.hidden = false;
	}

	window.addEventListener("appinstalled", () => {
		hint.hidden = true;
	});
	hint
		.querySelector('[data-install="dismiss"]')
		.addEventListener("click", () => {
			localStorage.setItem(DISMISSED, "1");
			hint.hidden = true;
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

/** The section on `/me` (FR-010, FR-011, research R8's state table). */
async function notifications() {
	const section = document.getElementById("notifications");
	if (!section) return;
	/** Shows exactly one state and at most one button. */
	const show = (state, action) => {
		for (const p of section.querySelectorAll("[data-state]")) {
			p.hidden = p.dataset.state !== state;
		}
		for (const button of section.querySelectorAll("[data-action]")) {
			button.hidden = button.dataset.action !== action;
		}
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

	section
		.querySelector('[data-action="on"]')
		.addEventListener("click", async () => {
			try {
				// Asked inside the tap, before anything else (FR-010).
				const permission = await Notification.requestPermission();
				if (permission === "denied") return show("blocked");
				if (permission !== "granted") return show("off", "on");
				subscription ??= await pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: fromBase64Url(section.dataset.pushKey),
				});
				await post("on", subscription.endpoint);
				setSignOutEndpoint(subscription.endpoint);
				show("on", "off");
			} catch {
				show("failed", "on");
			}
		});
	section
		.querySelector('[data-action="off"]')
		.addEventListener("click", async () => {
			try {
				if (subscription) {
					const { endpoint } = subscription;
					await subscription.unsubscribe();
					subscription = null;
					setSignOutEndpoint("");
					await post("off", endpoint);
				}
				show("off", "on");
			} catch {
				show("failed", "off");
			}
		});

	if (Notification.permission === "denied") {
		show("blocked");
	} else if (!subscription) {
		show("off", "on");
	} else {
		try {
			// The server decides: sign-out or another rider may have ended it.
			const on = await post("check", subscription.endpoint);
			show(on ? "on" : "off", on ? "off" : "on");
		} catch {
			show("failed", "on");
		}
	}
}

registerWorker();
installHint();
notifications().catch(() => {});
