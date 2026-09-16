import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";

export interface AccountSessionPrincipal {
  accountId: string;
  sessionId: string;
}

export type GitHubAvailabilityStatus = "available" | "waiting";

export interface GitHubAvailability {
  getStatus: () => GitHubAvailabilityStatus;
}

export interface AccountSessionSummary {
  current: boolean;
  device: string;
  id: string;
  lastActivityAt: string;
}

export interface AccountSessionAccess {
  listSessions: (
    principal: AccountSessionPrincipal,
  ) => Promise<AccountSessionSummary[]>;
  revokeOtherSessions: (principal: AccountSessionPrincipal) => Promise<void>;
  revokeSession: (
    principal: AccountSessionPrincipal,
    targetSessionAlias: string,
  ) => Promise<void>;
}

export interface Context {
  accountAccess: AccountSessionAccess;
  auth: null;
  db: Database;
  githubAvailability: GitHubAvailability;
  session: Awaited<
    ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
  >;
}
