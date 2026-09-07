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
import { productServerUrl } from "@/lib/product-server-url";
import { retryOnceFor } from "@/lib/retry-once";

const retriedMutations = new WeakSet<object>();
const retriedQueries = new WeakSet<object>();

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			mutations: { retry: 0 },
			queries: { retry: 0 },
		},
		mutationCache: new MutationCache({
			onError: (error, variables, _onMutateResult, mutation) => {
				showMainFlowFailure(
					error,
					retryOnceFor(mutation, retriedMutations, () => {
						mutation.execute(variables);
					})
				);
			},
			onSuccess: (_data, _variables, _onMutateResult, mutation) => {
				retriedMutations.delete(mutation);
			},
		}),
		queryCache: new QueryCache({
			onError: (error, query) => {
				showQueryMainFlowFailure(
					error,
					retryOnceFor(query, retriedQueries, () => {
						query.invalidate();
					})
				);
			},
			onSuccess: (_data, query) => {
				retriedQueries.delete(query);
			},
		}),
	});
}

export const queryClient = createQueryClient();

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
	url: `${productServerUrl(env.VITE_SERVER_URL)}/rpc`,
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
