import type { AppRouterClient } from "@cantiara/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { env } from "../env";
import { createTauriBearerHeaders } from "../features/account-access/tauri-session";
import { createClientShellQueryClient } from "../features/web-macos-client/client-shell";

export const createQueryClient = createClientShellQueryClient;
export const queryClient = createClientShellQueryClient();

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
