import type {
  AccountPreferences,
  AccountPreferencesAccess,
} from "@cantiara/api/account-preferences";
import type {
  AccountAccessClient,
  AccountPreferencesCompatibilityAccess,
  Context as ApiContext,
  GitHubAvailability,
} from "@cantiara/api/context";
import { DESKTOP_API_CONTRACT_HEADER } from "@cantiara/api/desktop-api-window";
import type {
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";
import type { Context as HonoContext } from "hono";
import { requestClientIp } from "./features/account-access/server/client-ip";
import type { GitHubIdentityConfirmation } from "./features/account-access/server/github-identity-confirmation";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";

export type AccountAccessAuth = Pick<
  ReturnType<typeof createAuth>,
  "api" | "handler"
>;

export interface CreateContextOptions {
  accountPreferences: AccountPreferencesAccess;
  accountPreferencesCompatibility?: AccountPreferencesCompatibilityAccess;
  accountPreferencesMutationContract?: MutationContract<AccountPreferences>;
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  context: HonoContext;
  database: Database;
  githubAvailability: GitHubAvailability;
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
  mutationContract?: MutationContract<MutationPayload>;
  trustedProxyIps: readonly string[];
}

export function requestClientPlatform(request: Request): AccountAccessClient {
  return request.headers.get("origin") === "http://tauri.localhost" ||
    request.headers.get("origin") === "tauri://localhost"
    ? "tauri"
    : "web";
}

export async function createContext({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  auth,
  context,
  database,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  trustedProxyIps,
}: CreateContextOptions): Promise<ApiContext> {
  const candidateSession = await auth.api.getSession({
    headers: context.req.raw.headers,
    query: { disableRefresh: true },
  });
  const principal = candidateSession
    ? {
        accountId: candidateSession.user.id,
        sessionId: candidateSession.session.id,
      }
    : null;
  const authorized = principal
    ? await accountSessionAccess.authorizeWrite(principal)
    : false;
  const session = authorized ? candidateSession : null;
  return {
    accountAccess: accountSessionAccess,
    accountPreferences,
    accountPreferencesCompatibility,
    accountPreferencesMutationContract,
    clientKey: requestClientIp(context.req.raw, context, trustedProxyIps),
    clientPlatform: requestClientPlatform(context.req.raw),
    desktopApiContract:
      context.req.raw.headers.get(DESKTOP_API_CONTRACT_HEADER) ?? undefined,
    db: database,
    githubAvailability,
    githubIdentityConfirmation,
    mutationContract,
    auth: null,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
