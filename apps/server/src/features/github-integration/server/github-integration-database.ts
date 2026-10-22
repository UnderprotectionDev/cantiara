// biome-ignore-all lint/performance/noAwaitInLoops: Each Project's installation effect is applied in its own transaction.
import type {
  GitHubAppGateway,
  GitHubExternalRecord,
  GitHubIntegrationStore,
  GitHubIntegrationTransaction,
  GitHubStopReason,
  GitHubStoredInstallation,
  GitHubStoredLink,
  GitHubTriageState,
} from "@cantiara/api/github-integration";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  githubExternalRecord,
  githubInstallation,
  githubInstallationCredential,
  githubRepositoryLink,
  githubRepositoryLinkName,
} from "@cantiara/db/schema/github-integration";
import { project } from "@cantiara/db/schema/project";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { GitHubSecrets } from "./github-credential-envelope";
import { createGitHubIntegration } from "./github-integration";

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function findProject(
  executor: Executor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ archivedAt: project.archivedAt, id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  const [owned] = lock
    ? await query.for("update", { of: project })
    : await query;
  return owned ?? null;
}

const iso = (value: Date) => value.toISOString();

function toInstallation(
  row: typeof githubInstallation.$inferSelect,
): GitHubStoredInstallation {
  return {
    accountLogin: row.accountLogin,
    connectedByAccountId: row.connectedByAccountId,
    createdAt: iso(row.createdAt),
    id: row.id,
    installationId: row.installationId,
    projectId: row.projectId,
    removedAt: row.removedAt ? iso(row.removedAt) : null,
  };
}

function toLink(
  row: typeof githubRepositoryLink.$inferSelect,
): GitHubStoredLink {
  return {
    disconnectedAt: row.disconnectedAt ? iso(row.disconnectedAt) : null,
    htmlUrl: row.htmlUrl,
    id: row.id,
    installationRowId: row.installationRowId,
    linkedAt: iso(row.linkedAt),
    name: row.name,
    owner: row.owner,
    projectId: row.projectId,
    repositoryId: row.repositoryId,
    stopReason: row.stopReason as GitHubStopReason | null,
    triage: row.triageState as GitHubTriageState,
  };
}

function toRecord(
  row: typeof githubExternalRecord.$inferSelect,
): GitHubExternalRecord {
  return {
    githubId: row.githubId,
    htmlUrl: row.htmlUrl,
    id: row.id,
    kind: row.kind as GitHubExternalRecord["kind"],
    labels: row.labels,
    linkId: row.linkId,
    milestone: row.milestone,
    number: row.number,
    projectId: row.projectId,
    sourceState: row.sourceState as GitHubExternalRecord["sourceState"],
    sourceUpdatedAt: iso(row.sourceUpdatedAt),
    title: row.title,
  };
}

const optionalDate = (value: string | null | undefined) =>
  value ? new Date(value) : null;

function transactionFor(
  executor: Executor,
  projectId: string,
  readOnly: boolean,
): GitHubIntegrationTransaction {
  return {
    claimsOfInstallation: async (installationId) =>
      await executor
        .select({
          connectedByAccountId: githubInstallation.connectedByAccountId,
          projectId: githubInstallation.projectId,
        })
        .from(githubInstallation)
        .where(eq(githubInstallation.installationId, installationId)),
    insertInstallation: async (row) => {
      await executor.insert(githubInstallation).values({
        accountLogin: row.accountLogin,
        connectedByAccountId: row.connectedByAccountId,
        createdAt: new Date(row.createdAt),
        id: row.id,
        installationId: row.installationId,
        projectId: row.projectId,
        removedAt: optionalDate(row.removedAt),
      });
    },
    insertLink: async (row) => {
      await executor.insert(githubRepositoryLink).values({
        disconnectedAt: optionalDate(row.disconnectedAt),
        htmlUrl: row.htmlUrl,
        id: row.id,
        installationRowId: row.installationRowId,
        linkedAt: new Date(row.linkedAt),
        name: row.name,
        owner: row.owner,
        projectId: row.projectId,
        repositoryId: row.repositoryId,
        stopReason: row.stopReason,
        triageState: row.triage,
      });
    },
    installationByGitHubId: async (installationId) => {
      const [row] = await executor
        .select()
        .from(githubInstallation)
        .where(
          and(
            eq(githubInstallation.projectId, projectId),
            eq(githubInstallation.installationId, installationId),
          ),
        );
      return row ? toInstallation(row) : null;
    },
    installations: async () =>
      (
        await executor
          .select()
          .from(githubInstallation)
          .where(eq(githubInstallation.projectId, projectId))
          .orderBy(asc(githubInstallation.createdAt))
      ).map(toInstallation),
    linkById: async (id) => {
      const [row] = await executor
        .select()
        .from(githubRepositoryLink)
        .where(
          and(
            eq(githubRepositoryLink.projectId, projectId),
            eq(githubRepositoryLink.id, id),
          ),
        );
      return row ? toLink(row) : null;
    },
    linkByRepositoryId: async (repositoryId) => {
      const [row] = await executor
        .select()
        .from(githubRepositoryLink)
        .where(
          and(
            eq(githubRepositoryLink.projectId, projectId),
            eq(githubRepositoryLink.repositoryId, repositoryId),
          ),
        );
      return row ? toLink(row) : null;
    },
    links: async () =>
      (
        await executor
          .select()
          .from(githubRepositoryLink)
          .where(eq(githubRepositoryLink.projectId, projectId))
          .orderBy(asc(githubRepositoryLink.linkedAt))
      ).map(toLink),
    loadCredential: async (installationRowId) => {
      const [row] = await executor
        .select()
        .from(githubInstallationCredential)
        .where(
          eq(githubInstallationCredential.installationRowId, installationRowId),
        );
      return row
        ? {
            expiresAt: iso(row.expiresAt),
            sealed: {
              ciphertext: row.ciphertext,
              keyVersion: row.keyVersion,
              wrappedDataKey: row.wrappedDataKey,
            },
          }
        : null;
    },
    nameHistory: async (linkId) =>
      (
        await executor
          .select()
          .from(githubRepositoryLinkName)
          .where(eq(githubRepositoryLinkName.linkId, linkId))
          .orderBy(asc(githubRepositoryLinkName.observedAt))
      ).map((row) => ({
        name: row.name,
        observedAt: iso(row.observedAt),
        owner: row.owner,
      })),
    readOnly,
    recordNameHistory: async (linkId, entry) => {
      await executor
        .insert(githubRepositoryLinkName)
        .values({
          linkId,
          name: entry.name,
          observedAt: new Date(entry.observedAt),
          owner: entry.owner,
        })
        .onConflictDoNothing();
    },
    records: async (linkId) =>
      (
        await executor
          .select()
          .from(githubExternalRecord)
          .where(
            linkId
              ? and(
                  eq(githubExternalRecord.projectId, projectId),
                  eq(githubExternalRecord.linkId, linkId),
                )
              : eq(githubExternalRecord.projectId, projectId),
          )
          .orderBy(desc(githubExternalRecord.sourceUpdatedAt))
      ).map(toRecord),
    saveCredential: async (installationRowId, credential) => {
      const values = {
        ciphertext: credential.sealed.ciphertext,
        expiresAt: new Date(credential.expiresAt),
        keyVersion: credential.sealed.keyVersion,
        updatedAt: new Date(),
        wrappedDataKey: credential.sealed.wrappedDataKey,
      };
      await executor
        .insert(githubInstallationCredential)
        .values({ installationRowId, ...values })
        .onConflictDoUpdate({
          set: values,
          target: githubInstallationCredential.installationRowId,
        });
    },
    updateInstallation: async (id, patch) => {
      await executor
        .update(githubInstallation)
        .set({
          ...(patch.removedAt === undefined
            ? {}
            : { removedAt: optionalDate(patch.removedAt) }),
        })
        .where(eq(githubInstallation.id, id));
    },
    updateLink: async (id, patch) => {
      await executor
        .update(githubRepositoryLink)
        .set({
          ...(patch.disconnectedAt === undefined
            ? {}
            : { disconnectedAt: optionalDate(patch.disconnectedAt) }),
          ...(patch.htmlUrl === undefined ? {} : { htmlUrl: patch.htmlUrl }),
          ...(patch.installationRowId === undefined
            ? {}
            : { installationRowId: patch.installationRowId }),
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.owner === undefined ? {} : { owner: patch.owner }),
          ...(patch.stopReason === undefined
            ? {}
            : { stopReason: patch.stopReason }),
          ...(patch.triage === undefined ? {} : { triageState: patch.triage }),
        })
        .where(eq(githubRepositoryLink.id, id));
    },
    upsertExternalRecords: async (writes) => {
      for (const write of writes) {
        const values = {
          githubId: write.snapshot.githubId,
          htmlUrl: write.snapshot.htmlUrl,
          kind: write.snapshot.kind,
          labels: write.snapshot.labels,
          milestone: write.snapshot.milestone,
          number: write.snapshot.number,
          sourceState: write.snapshot.sourceState,
          sourceUpdatedAt: new Date(write.snapshot.sourceUpdatedAt),
          title: write.snapshot.title,
        };
        await executor
          .insert(githubExternalRecord)
          .values({
            id: write.id,
            linkId: write.linkId,
            projectId: write.projectId,
            ...values,
          })
          .onConflictDoUpdate({
            set: values,
            setWhere: sql`${githubExternalRecord.sourceUpdatedAt} <= excluded.source_updated_at`,
            target: [
              githubExternalRecord.linkId,
              githubExternalRecord.kind,
              githubExternalRecord.githubId,
            ],
          });
      }
    },
  };
}

export function createDatabaseGitHubIntegrationStore(
  database: Database,
): GitHubIntegrationStore {
  return {
    run(accountId, projectId, mode, work) {
      return database.transaction(async (executor) => {
        const owned = await findProject(
          executor,
          accountId,
          projectId,
          mode === "write",
        );
        if (!owned) {
          return null;
        }
        return await work(
          transactionFor(executor, owned.id, owned.archivedAt !== null),
        );
      });
    },

    async runForInstallation(installationId, work) {
      const projectIds = [
        ...new Set(
          (
            await database
              .select({ projectId: githubInstallation.projectId })
              .from(githubInstallation)
              .where(eq(githubInstallation.installationId, installationId))
          ).map((row) => row.projectId),
        ),
      ];
      for (const scope of projectIds) {
        await database.transaction(async (executor) => {
          await work(transactionFor(executor, scope, false), scope);
        });
      }
    },
  };
}

export function createDatabaseGitHubIntegration(options: {
  gateway: GitHubAppGateway | null;
  secrets: GitHubSecrets;
  database: Database;
}) {
  return createGitHubIntegration({
    gateway: options.gateway,
    secrets: options.secrets,
    store: createDatabaseGitHubIntegrationStore(options.database),
  });
}
