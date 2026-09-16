import type { AppRouterClient } from "@cantiara/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { env } from "../env";
import { createTauriBearerHeaders } from "../features/account-access/tauri-session";

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
  url: `${env.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
  async fetch(request, init) {
    const headers = await createTauriBearerHeaders(request.headers);
    return globalThis.fetch(request, {
      ...init,
      credentials: "include",
      headers,
    });
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
