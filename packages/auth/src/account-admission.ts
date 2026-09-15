import type { Database } from "@cantiara/db";
import { account, rateLimit, workspace } from "@cantiara/db/schema/auth";
import { and, eq, sql } from "drizzle-orm";

import {
  type AccountIdentityRateLimit,
  type AccountWorkspaceStore,
  createAccountAdmission,
  type GitHubIdentityStore,
} from "./account-access";

const ACCOUNT_RATE_LIMIT_MAX = 5;
const ACCOUNT_RATE_LIMIT_WINDOW_MS = 60_000;

export function createDatabaseAccountAdmission(
  database: Database,
  now: () => number = Date.now,
) {
  const githubIdentities: GitHubIdentityStore = {
    async findByAccountId(accountId) {
      const githubIdentity = await database.query.account.findFirst({
        columns: { accountId: true },
        where: and(
          eq(account.userId, accountId),
          eq(account.providerId, "github"),
        ),
      });
      return githubIdentity ? { id: githubIdentity.accountId } : null;
    },
  };

  const accountIdentityRateLimit: AccountIdentityRateLimit = {
    async consume(githubIdentityId) {
      const requestedAt = now();
      const windowStart = requestedAt - ACCOUNT_RATE_LIMIT_WINDOW_MS;
      const [limit] = await database
        .insert(rateLimit)
        .values({
          id: crypto.randomUUID(),
          key: `account:${githubIdentityId}`,
          count: 1,
          lastRequest: requestedAt,
        })
        .onConflictDoUpdate({
          target: rateLimit.key,
          set: {
            count: sql<number>`case when ${rateLimit.lastRequest} < ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
            lastRequest: sql<number>`case when ${rateLimit.lastRequest} < ${windowStart} then ${requestedAt} else ${rateLimit.lastRequest} end`,
          },
        })
        .returning({ count: rateLimit.count });
      return Boolean(limit && limit.count <= ACCOUNT_RATE_LIMIT_MAX);
    },
  };

  const workspaces: AccountWorkspaceStore = {
    async findOrCreate(accountId) {
      const [created] = await database
        .insert(workspace)
        .values({
          id: crypto.randomUUID(),
          ownerAccountId: accountId,
        })
        .onConflictDoNothing({ target: workspace.ownerAccountId })
        .returning({ workspaceId: workspace.id });
      if (created) {
        return { accountId, workspaceId: created.workspaceId };
      }

      const existing = await database.query.workspace.findFirst({
        columns: { id: true },
        where: eq(workspace.ownerAccountId, accountId),
      });
      if (!existing) {
        throw new Error("Workspace admission failed");
      }
      return { accountId, workspaceId: existing.id };
    },
  };

  return createAccountAdmission({
    githubIdentities,
    rateLimit: accountIdentityRateLimit,
    workspaces,
  });
}
