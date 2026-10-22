import { test as base } from "@playwright/test";

/**
 * The e2e files' `test`. Playwright's WebKit has no push service:
 * getSubscription() never returns and blocks the page (#211). Without
 * PushManager, the app treats it as a browser without push and Settings
 * shows notifications as unsupported.
 */
export const test = base.extend<{ noPushInWebKit: undefined }>({
	noPushInWebKit: [
		async ({ page, browserName }, use) => {
			if (browserName === "webkit") {
				await page.addInitScript(() => {
					delete (globalThis as { PushManager?: unknown }).PushManager;
				});
			}
			await use(undefined);
		},
		{ auto: true },
	],
});
