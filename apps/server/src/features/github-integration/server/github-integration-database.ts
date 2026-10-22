// biome-ignore-all lint/performance/noAwaitInLoops: Each Project's installation effect is applied in its own transaction.
import type {
  GitHubAppGateway,
  GitHubExternalRecord,
  GitHubIntegrationStore,
  GitHubIntegrationTransaction,
  GitHubRecordWriteOutcome,
  GitHubStopReason,
  GitHubStoredInstallation,
  GitHubStoredLink,
  GitHubStoredRecord,
  GitHubTriageState,
} from "@cantiara/api/github-integration";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  githubExternalRecord,
  githubExternalRecordTombstone,
  githubInstallation,
  githubInstallationCredential,
  githubLinkHistory,
  githubRepositoryLink,
  githubRepositoryLinkName,
} from "@cantiara/db/schema/github-integration";
import { project } from "@cantiara/db/schema/project";
import { and, asc, desc, eq } from "drizzle-orm";

import type { GitHubSecrets } from "./github-credential-envelope";
import { createGitHubIntegration } from "./github-integration";
import { decideRecordWrite } from "./github-record-ordering";

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
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt ? iso(row.lastErrorAt) : null,
    lastSuccessAt: row.lastSuccessAt ? iso(row.lastSuccessAt) : null,
    linkedAt: iso(row.linkedAt),
    name: row.name,
    owner: row.owner,
    pausedAt: row.pausedAt ? iso(row.pausedAt) : null,
    projectId: row.projectId,
    rateLimitedUntil: row.rateLimitedUntil ? iso(row.rateLimitedUntil) : null,
    repositoryId: row.repositoryId,
    stopReason: row.stopReason as GitHubStopReason | null,
    syncCursor: row.syncCursor ? iso(row.syncCursor) : null,
    triage: row.triageState as GitHubTriageState,
  };
}

function toRecord(
  row: typeof githubExternalRecord.$inferSelect,
): GitHubStoredRecord {
  let lifecycle: GitHubExternalRecord["lifecycle"] = "Active";
  if (row.trashedAt) {
    lifecycle = "Trash";
  } else if (row.archivedAt) {
    lifecycle = "Archived";
  }
  return {
    appliedFrom: row.appliedFrom as GitHubStoredRecord["appliedFrom"],
    githubId: row.githubId,
    htmlUrl: row.htmlUrl,
    id: row.id,
    kind: row.kind as GitHubExternalRecord["kind"],
    labels: row.labels,
    lifecycle,
    linkId: row.linkId,
    milestone: row.milestone,
    needsReconcile: row.needsReconcile,
    number: row.number,
    origin:
      row.originRecordId && row.originDeletedAt
        ? {
            deletedAt: iso(row.originDeletedAt),
            recordId: row.originRecordId,
          }
        : null,
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
        lastError: row.lastError,
        lastErrorAt: optionalDate(row.lastErrorAt),
        lastSuccessAt: optionalDate(row.lastSuccessAt),
        linkedAt: new Date(row.linkedAt),
        name: row.name,
        owner: row.owner,
        pausedAt: optionalDate(row.pausedAt),
        projectId: row.projectId,
        rateLimitedUntil: optionalDate(row.rateLimitedUntil),
        repositoryId: row.repositoryId,
        stopReason: row.stopReason,
        syncCursor: optionalDate(row.syncCursor),
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
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One locked read decides the ordering outcome and writes it in the same transaction.
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
          ...(patch.lastError === undefined
            ? {}
            : { lastError: patch.lastError }),
          ...(patch.lastErrorAt === undefined
            ? {}
            : { lastErrorAt: optionalDate(patch.lastErrorAt) }),
          ...(patch.lastSuccessAt === undefined
            ? {}
            : { lastSuccessAt: optionalDate(patch.lastSuccessAt) }),
          ...(patch.pausedAt === undefined
            ? {}
            : { pausedAt: optionalDate(patch.pausedAt) }),
          ...(patch.rateLimitedUntil === undefined
            ? {}
            : { rateLimitedUntil: optionalDate(patch.rateLimitedUntil) }),
          ...(patch.syncCursor === undefined
            ? {}
            : { syncCursor: optionalDate(patch.syncCursor) }),
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.owner === undefined ? {} : { owner: patch.owner }),
          ...(patch.stopReason === undefined
            ? {}
            : { stopReason: patch.stopReason }),
          ...(patch.triage === undefined ? {} : { triageState: patch.triage }),
        })
        .where(eq(githubRepositoryLink.id, id));
    },
    upsertExternalRecords: async (writes, options) => {
      const outcomes: GitHubRecordWriteOutcome[] = [];
      for (const write of writes) {
        const { snapshot } = write;
        const [row] = await executor
          .select()
          .from(githubExternalRecord)
          .where(
            and(
              eq(githubExternalRecord.linkId, write.linkId),
              eq(githubExternalRecord.kind, snapshot.kind),
              eq(githubExternalRecord.githubId, snapshot.githubId),
            ),
          )
          .for("update");
        const existing = row ? toRecord(row) : null;
        const [tombstone] = existing
          ? []
          : await executor
              .select({ recordId: githubExternalRecordTombstone.recordId })
              .from(githubExternalRecordTombstone)
              .where(
                and(
                  eq(githubExternalRecordTombstone.linkId, write.linkId),
                  eq(githubExternalRecordTombstone.kind, snapshot.kind),
                  eq(githubExternalRecordTombstone.githubId, snapshot.githubId),
                ),
              );
        const decision = decideRecordWrite({
          existing,
          options,
          snapshot,
          tombstoned: Boolean(tombstone),
        });
        const values = {
          appliedFrom: options.origin,
          githubId: snapshot.githubId,
          htmlUrl: snapshot.htmlUrl,
          kind: snapshot.kind,
          labels: snapshot.labels,
          milestone: snapshot.milestone,
          needsReconcile: false,
          number: snapshot.number,
          sourceState: snapshot.sourceState,
          sourceUpdatedAt: new Date(snapshot.sourceUpdatedAt),
          title: snapshot.title,
        };
        const outcome: GitHubRecordWriteOutcome = {
          conflict: decision.conflict,
          githubId: snapshot.githubId,
          kind: snapshot.kind,
          recordId: existing?.id ?? null,
          replaced: null,
          result: decision.result,
        };
        if (decision.action === "insert") {
          await executor.insert(githubExternalRecord).values({
            id: write.id,
            linkId: write.linkId,
            projectId: write.projectId,
            ...values,
          });
          outcome.recordId = write.id;
        } else if (decision.action === "update" && existing) {
          if (existing.needsReconcile) {
            outcome.replaced = {
              sourceState: existing.sourceState,
              title: existing.title,
            };
          }
          await executor
            .update(githubExternalRecord)
            .set(values)
            .where(eq(githubExternalRecord.id, existing.id));
        }
        outcomes.push(outcome);
      }
      return outcomes;
    },
    appendHistory: async (linkId, entry) => {
      await executor.insert(githubLinkHistory).values({
        at: new Date(entry.at),
        detail: entry.detail,
        id: crypto.randomUUID(),
        kind: entry.kind,
        linkId,
      });
    },
    deleteCredential: async (installationRowId) => {
      await executor
        .delete(githubInstallationCredential)
        .where(
          eq(githubInstallationCredential.installationRowId, installationRowId),
        );
    },
    deleteRecordWithTombstone: async (recordId, at) => {
      const [row] = await executor
        .select()
        .from(githubExternalRecord)
        .where(eq(githubExternalRecord.id, recordId));
      if (!row) {
        return;
      }
      await executor
        .insert(githubExternalRecordTombstone)
        .values({
          deletedAt: new Date(at),
          githubId: row.githubId,
          kind: row.kind,
          linkId: row.linkId,
          number: row.number,
          recordId: row.id,
        })
        .onConflictDoNothing();
      await executor
        .delete(githubExternalRecord)
        .where(eq(githubExternalRecord.id, recordId));
    },
    history: async (linkId) =>
      (
        await executor
          .select()
          .from(githubLinkHistory)
          .where(eq(githubLinkHistory.linkId, linkId))
          .orderBy(asc(githubLinkHistory.at))
      ).map((row) => ({
        at: iso(row.at),
        detail: row.detail,
        kind: row.kind,
      })),
    recordById: async (recordId) => {
      const [row] = await executor
        .select()
        .from(githubExternalRecord)
        .where(
          and(
            eq(githubExternalRecord.projectId, projectId),
            eq(githubExternalRecord.id, recordId),
          ),
        );
      return row ? toRecord(row) : null;
    },
    reincludeRecord: async (write) => {
      await executor
        .delete(githubExternalRecordTombstone)
        .where(
          and(
            eq(githubExternalRecordTombstone.linkId, write.linkId),
            eq(githubExternalRecordTombstone.kind, write.snapshot.kind),
            eq(githubExternalRecordTombstone.githubId, write.snapshot.githubId),
          ),
        );
      const [row] = await executor
        .insert(githubExternalRecord)
        .values({
          githubId: write.snapshot.githubId,
          htmlUrl: write.snapshot.htmlUrl,
          id: write.id,
          kind: write.snapshot.kind,
          labels: write.snapshot.labels,
          linkId: write.linkId,
          milestone: write.snapshot.milestone,
          number: write.snapshot.number,
          originDeletedAt: write.origin
            ? new Date(write.origin.deletedAt)
            : null,
          originRecordId: write.origin?.recordId ?? null,
          projectId: write.projectId,
          sourceState: write.snapshot.sourceState,
          sourceUpdatedAt: new Date(write.snapshot.sourceUpdatedAt),
          title: write.snapshot.title,
        })
        .returning();
      if (!row) {
        throw new Error("Re-included record was not stored");
      }
      return toRecord(row);
    },
    setRecordLifecycle: async (recordId, patch) => {
      await executor
        .update(githubExternalRecord)
        .set({
          ...(patch.archivedAt === undefined
            ? {}
            : { archivedAt: optionalDate(patch.archivedAt) }),
          ...(patch.needsReconcile === undefined
            ? {}
            : { needsReconcile: patch.needsReconcile }),
          ...(patch.trashedAt === undefined
            ? {}
            : { trashedAt: optionalDate(patch.trashedAt) }),
        })
        .where(eq(githubExternalRecord.id, recordId));
    },
    tombstone: async (linkId, kind, githubId) => {
      const [row] = await executor
        .select()
        .from(githubExternalRecordTombstone)
        .where(
          and(
            eq(githubExternalRecordTombstone.linkId, linkId),
            eq(githubExternalRecordTombstone.kind, kind),
            eq(githubExternalRecordTombstone.githubId, githubId),
          ),
        );
      return row
        ? {
            deletedAt: iso(row.deletedAt),
            number: row.number,
            recordId: row.recordId,
          }
        : null;
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

    async linkScopes() {
      return await database
        .select({
          linkId: githubRepositoryLink.id,
          projectId: githubRepositoryLink.projectId,
        })
        .from(githubRepositoryLink);
    },

    runForProject(projectId, work) {
      return database.transaction(async (executor) => {
        const [owned] = await executor
          .select({ archivedAt: project.archivedAt, id: project.id })
          .from(project)
          .where(eq(project.id, projectId))
          .for("update");
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
          const [owned] = await executor
            .select({ archivedAt: project.archivedAt })
            .from(project)
            .where(eq(project.id, scope))
            .for("update");
          await work(
            transactionFor(executor, scope, Boolean(owned?.archivedAt)),
            scope,
          );
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
