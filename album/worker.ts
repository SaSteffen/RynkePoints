// The entry `wrangler dev -c album/wrangler.jsonc` runs (feature 021 research
// R12). Only `pnpm season:album` starts it; it is never deployed, and nothing
// under src/ imports it (test/unit/dev-guard.test.ts).

import css from "./album.css";
import black from "./fonts/Nunito-Black.woff2";
import bold from "./fonts/Nunito-Bold.woff2";
import regular from "./fonts/Nunito-Regular.woff2";
import { type AlbumEnv, handleAlbumRequest } from "./routes";

const FILES = {
	css,
	fonts: {
		"Nunito-Regular.woff2": regular,
		"Nunito-Bold.woff2": bold,
		"Nunito-Black.woff2": black,
	},
};

export default {
	fetch(request: Request, env: AlbumEnv): Promise<Response> {
		return handleAlbumRequest(request, env, FILES);
	},
};
