import type {
  Context as ApiContext,
  GitHubAvailability,
} from "@cantiara/api/context";
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
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  context: HonoContext;
  database: Database;
  githubAvailability: GitHubAvailability;
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
  trustedProxyIps: readonly string[];
}

export async function createContext({
  accountSessionAccess,
  auth,
  context,
  database,
  githubAvailability,
  githubIdentityConfirmation,
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
    clientKey: requestClientIp(context.req.raw, context, trustedProxyIps),
    db: database,
    githubAvailability,
    githubIdentityConfirmation,
    auth: null,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
