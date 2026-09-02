import { env } from "@cantiara/env/web";
import { createAuthClient } from "better-auth/react";

import { withProductSessionHeaders } from "@/features/account-access/forms/tauri-session-token";
import { productServerUrl } from "@/lib/product-server-url";

export const authClient = createAuthClient({
	// better-auth derives its route-matching base from this URL's path, so the
	// public auth path must equal the server-side mount (/api/auth everywhere)
	baseURL: new URL(
		"/api/auth",
		productServerUrl(env.VITE_SERVER_URL)
	).toString(),
	fetchOptions: {
		customFetchImpl: (url, init) =>
			fetch(url, {
				...init,
				credentials: "include",
				headers: withProductSessionHeaders(init?.headers),
			}),
	},
});
