import type { AppRouterClient } from "@cantiara/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { env } from "../env";
import { createTauriBearerHeaders } from "../features/account-access/tauri-session";
import { createClientShellQueryClient } from "../features/web-macos-client/client-shell";
import { defaultClientShell } from "../features/web-macos-client/views/client-shell";

export function createQueryClient() {
  const queryClient = createClientShellQueryClient();
  queryClient.setDefaultOptions({
    mutations: {
      networkMode: "always",
      retry: false,
    },
    queries: {
      networkMode: "always",
      retry: false,
    },
  });
  return queryClient;
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
  url: `${env.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
  async fetch(request, init) {
    const headers = await createTauriBearerHeaders(request.headers);
    return defaultClientShell.request(
      request,
      {
        ...init,
        credentials: "include",
        headers,
      },
      globalThis.fetch,
    );
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);

const accountPreferencesQueryPrefix =
  orpc.accountPreferences.queryOptions().queryKey;

export function accountPreferencesQueryOptions(accountId?: string) {
  return {
    ...orpc.accountPreferences.queryOptions(),
    enabled: Boolean(accountId),
    queryKey: [
      ...accountPreferencesQueryPrefix,
      accountId ?? "anonymous",
    ] as const,
  };
}

export { accountPreferencesQueryPrefix };

const captureInboxQueryPrefix = orpc.captureInbox.queryOptions().queryKey;

export function captureInboxQueryOptions(accountId?: string) {
  return {
    ...orpc.captureInbox.queryOptions(),
    enabled: Boolean(accountId),
    queryKey: [...captureInboxQueryPrefix, accountId ?? "anonymous"] as const,
  };
}

export { captureInboxQueryPrefix };
