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
}

function createAccountAccessError() {
  return new Error(ACCOUNT_ACCESS_FAILURE_CODE);
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
    async admitAccount(accountId: string) {
      try {
        const githubIdentity =
          await githubIdentities.findByAccountId(accountId);
        if (!githubIdentity) {
          throw createAccountAccessError();
        }

        // A trusted identity is only available after GitHub returns. Attribute the
        // state-verified start and the callback to separate identity budgets here.
        const startAllowed = await rateLimit.consume(
          githubIdentity.id,
          "start",
        );
        const callbackAllowed = await rateLimit.consume(
          githubIdentity.id,
          "callback",
        );
        if (!(startAllowed && callbackAllowed)) {
          throw createAccountAccessError();
        }
        const workspace = await workspaces.findByAccountId(accountId);
        if (!workspace) {
          throw createAccountAccessError();
        }
        return workspace;
      } catch {
        // biome-ignore lint/style/useErrorCause: Account Access errors must not retain existence-sensitive details.
        throw createAccountAccessError();
      }
    },
  };
}
