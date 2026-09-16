import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";

export interface AccountSessionPrincipal {
  accountId: string;
  sessionId: string;
}

export const CONFIRM_GITHUB_IDENTITY_OPERATION_IDS = [
  "account-closure-start",
  "account-closure-cancel",
  "security-redaction",
  "early-permanent-delete",
  "personal-data-erase",
] as const;

export type ConfirmGitHubIdentityOperationId =
  (typeof CONFIRM_GITHUB_IDENTITY_OPERATION_IDS)[number];

export interface GitHubIdentityConfirmationAccess {
  consume: (
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    grant: string,
    clientKey?: string,
  ) => Promise<boolean>;
  start: (
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    clientKey?: string,
  ) => Promise<{ authorizationUrl: string } | null>;
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
  clientKey?: string;
  db: Database;
  githubAvailability: GitHubAvailability;
  githubIdentityConfirmation?: GitHubIdentityConfirmationAccess;
  session: Awaited<
    ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
  >;
}
