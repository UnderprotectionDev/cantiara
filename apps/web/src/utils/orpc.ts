import { env } from "@cantiara/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "server/routes";

import { withProductSessionHeaders } from "@/features/account-access/forms/tauri-session-token";
import {
	showMainFlowFailure,
	showQueryMainFlowFailure,
} from "@/features/web-macos-client/show-main-flow-failure";
import { withDesktopApiHeaders } from "@/features/web-macos-client/views/client-shell";

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			mutations: { retry: 0 },
			queries: { retry: 0 },
		},
		mutationCache: new MutationCache({
			onError: (error, variables, _onMutateResult, mutation) => {
				showMainFlowFailure(error, () => {
					mutation.execute(variables);
				});
			},
		}),
		queryCache: new QueryCache({
			onError: (error, query) => {
				showQueryMainFlowFailure(error, () => {
					query.invalidate();
				});
			},
		}),
	});
}

export const queryClient = createQueryClient();

function getServerUrl(url: string) {
	const processEnv = (
		globalThis as {
			process?: { env?: Record<string, string | undefined> };
		}
	).process?.env;
	if (typeof window === "undefined" && processEnv?.SERVER_URL) {
		return processEnv.SERVER_URL.endsWith("/")
			? processEnv.SERVER_URL.slice(0, -1)
			: processEnv.SERVER_URL;
	}

	const normalized = url.endsWith("/") ? url.slice(0, -1) : url;

	if (!normalized.startsWith("/")) {
		return normalized;
	}

	if (typeof window !== "undefined") {
		return `${window.location.origin}${normalized}`;
	}

	const vercelUrl =
		processEnv?.VERCEL_ENV === "production"
			? (processEnv?.VERCEL_PROJECT_PRODUCTION_URL ?? processEnv?.VERCEL_URL)
			: (processEnv?.VERCEL_URL ?? processEnv?.VERCEL_PROJECT_PRODUCTION_URL);
	if (vercelUrl) {
		const origin = vercelUrl.startsWith("http")
			? vercelUrl
			: `https://${vercelUrl}`;
		return `${origin}${normalized}`;
	}

	return `http://localhost:3000${normalized}`;
}
export const link = new RPCLink({
	fetch(requestUrl, options) {
		const headers =
			options && "headers" in options
				? (options.headers as HeadersInit | undefined)
				: undefined;
		return globalThis.fetch(requestUrl, {
			...options,
			credentials: "include",
			headers: withDesktopApiHeaders(withProductSessionHeaders(headers)),
		});
	},
	url: `${getServerUrl(env.VITE_SERVER_URL)}/rpc`,
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
