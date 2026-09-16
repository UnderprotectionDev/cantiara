export const ACCOUNT_ACCESS_FAILURE_CODE = "ACCOUNT_ACCESS_FAILURE";

export const GITHUB_LOGIN_SCOPES = ["read:user", "user:email"] as const;

export interface GitHubIdentity {
  id: string;
}

export interface AccountWorkspaceAdmission {
  accountId: string;
  workspaceId: string;
}

export interface GitHubIdentityStore {
  findByAccountId: (accountId: string) => Promise<GitHubIdentity | null>;
}

export interface AccountWorkspaceStore {
  findByAccountId: (
    accountId: string,
  ) => Promise<AccountWorkspaceAdmission | null>;
}

export interface AccountIdentityRateLimit {
  consume: (
    githubIdentityId: string,
    stage: "start" | "callback",
  ) => Promise<boolean>;
}

export interface AccountAdmission {
  admitAccount: (accountId: string) => Promise<AccountWorkspaceAdmission>;
  admitGitHubCallback: (githubIdentityId: string) => Promise<boolean>;
}

function createAccountAccessError(cause?: unknown) {
  if (cause === undefined) {
    return new Error(ACCOUNT_ACCESS_FAILURE_CODE);
  }

  return new Error(ACCOUNT_ACCESS_FAILURE_CODE, {
    cause: new Error(ACCOUNT_ACCESS_FAILURE_CODE),
  });
}

export function createAccountAdmission({
  githubIdentities,
  rateLimit,
  workspaces,
}: {
  githubIdentities: GitHubIdentityStore;
  rateLimit: AccountIdentityRateLimit;
  workspaces: AccountWorkspaceStore;
}): AccountAdmission {
  return {
    async admitGitHubCallback(githubIdentityId) {
      try {
        return await rateLimit.consume(githubIdentityId, "callback");
      } catch {
        return false;
      }
    },
    async admitAccount(accountId: string) {
      try {
        const githubIdentity =
          await githubIdentities.findByAccountId(accountId);
        if (!githubIdentity) {
          throw createAccountAccessError();
        }

        const startAllowed = await rateLimit.consume(
          githubIdentity.id,
          "start",
        );
        if (!startAllowed) {
          throw createAccountAccessError();
        }
        const workspace = await workspaces.findByAccountId(accountId);
        if (!workspace) {
          throw createAccountAccessError();
        }
        return workspace;
      } catch (error) {
        // Do not expose provider, database, or existence-sensitive details.
        throw createAccountAccessError(error);
      }
    },
  };
}
