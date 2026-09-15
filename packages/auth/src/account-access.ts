export const ACCOUNT_ACCESS_FAILURE_MESSAGE =
  "Sign-in could not be completed. Please try again.";

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
  findOrCreate: (accountId: string) => Promise<AccountWorkspaceAdmission>;
}

export interface AccountIdentityRateLimit {
  consume: (githubIdentityId: string) => Promise<boolean>;
}

export interface AccountAdmission {
  admitAccount: (accountId: string) => Promise<AccountWorkspaceAdmission>;
}

function createAccountAccessError() {
  return new Error(ACCOUNT_ACCESS_FAILURE_MESSAGE);
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
        if (!(githubIdentity && (await rateLimit.consume(githubIdentity.id)))) {
          throw new Error(ACCOUNT_ACCESS_FAILURE_MESSAGE);
        }
        return await workspaces.findOrCreate(accountId);
      } catch {
        // biome-ignore lint/style/useErrorCause: Account Access errors must not retain existence-sensitive details.
        throw createAccountAccessError();
      }
    },
  };
}
