import type { AppRouterClient } from "@cantiara/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { env } from "../env";
import { createTauriBearerHeaders } from "../features/account-access/lib/tauri-session";
import { createClientShellQueryClient } from "../features/web-macos-client/lib/client-shell";
import { defaultClientShell } from "../features/web-macos-client/store/client-shell";
import { presentSupportReferenceFailure } from "../features/web-macos-client/ui/components/support-reference";

export function createQueryClient() {
  const queryClient = createClientShellQueryClient(
    presentSupportReferenceFailure,
  );
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
const completionEffectsPreferencesQueryPrefix =
  orpc.completionEffectsPreferences.queryOptions().queryKey;
export const projectsQueryPrefix = orpc.projects.queryOptions().queryKey;
export const workspaceOverviewQueryPrefix =
  orpc.workspaceOverview.queryOptions().queryKey;
export const projectWorksQueryPrefix = orpc.projectWorks
  .queryOptions({ input: { projectId: "" } })
  .queryKey.slice(0, 1);

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

export function completionEffectsPreferencesQueryOptions(accountId?: string) {
  return {
    ...orpc.completionEffectsPreferences.queryOptions(),
    enabled: Boolean(accountId),
    queryKey: [
      ...completionEffectsPreferencesQueryPrefix,
      accountId ?? "anonymous",
    ] as const,
  };
}

export {
  accountPreferencesQueryPrefix,
  completionEffectsPreferencesQueryPrefix,
};

export function projectsQueryOptions() {
  return {
    ...orpc.projects.queryOptions(),
    queryKey: projectsQueryPrefix,
  };
}

export function workspaceOverviewQueryOptions(accountId?: string) {
  return {
    ...orpc.workspaceOverview.queryOptions(),
    enabled: Boolean(accountId),
    queryKey: [
      ...workspaceOverviewQueryPrefix,
      accountId ?? "anonymous",
    ] as const,
  };
}

const captureInboxQueryPrefix = orpc.captureInbox.queryOptions().queryKey;

export function captureInboxQueryOptions(accountId?: string) {
  return {
    ...orpc.captureInbox.queryOptions(),
    enabled: Boolean(accountId),
    queryKey: [...captureInboxQueryPrefix, accountId ?? "anonymous"] as const,
  };
}

export { captureInboxQueryPrefix };
