// One picture of `snapAndTrace` (trace.mjs), in a worker thread.
import { readFileSync, renameSync, rmSync } from "node:fs";
import { parentPort } from "node:worker_threads";
import { snapToPalette, traceImage } from "./trace.mjs";

parentPort.on("message", ({ index, job }) => {
	try {
		const { original, png, colours, options } = job;
		// Snap to a temporary file, and replace the original only if it changed.
		const tmp = png.replace(/([^/]+)\.png$/, ".$1.snapping.png");
		snapToPalette(original, tmp, colours);
		let same = false;
		try {
			same = readFileSync(tmp).equals(readFileSync(png));
		} catch {}
		if (same) rmSync(tmp);
		else renameSync(tmp, png);
		if (original !== png) rmSync(original);
		parentPort.postMessage({
			index,
			result: traceImage(png, { colours, ...options }),
		});
	} catch (error) {
		parentPort.postMessage({ index, error: String(error?.stack ?? error) });
	}
});
