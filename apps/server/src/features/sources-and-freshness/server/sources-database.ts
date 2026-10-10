import {
  createSourceInputSchema,
  SourceConflictError,
  type SourceRecord,
  type SourcesAndFreshnessAccess,
  saveSourceVersionInputSchema,
  sourceProjectInputSchema,
  sourceRecordSchema,
  sourceSelectionSchema,
  sourceVersionSchema,
} from "@cantiara/api/sources-and-freshness";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { and, asc, eq } from "drizzle-orm";
import {
  MutationApplyFailedError,
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

interface SourceMutationValue {
  record: SourceRecord | null;
}

async function ownedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ archivedAt: project.archivedAt })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  const [row] = lock ? await query.for("update", { of: project }) : await query;
  return row && (!lock || row.archivedAt === null) ? row : null;
}

function toVersion(row: typeof sourceVersion.$inferSelect) {
  return sourceVersionSchema.parse({
    ...row,
    accessedAt: row.accessedAt.toISOString(),
    savedAt: row.savedAt.toISOString(),
  });
}
function toRecord(
  row: typeof source.$inferSelect,
  version: typeof sourceVersion.$inferSelect,
): SourceRecord {
  return sourceRecordSchema.parse({
    ...row,
    sourceType: "Source",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: toVersion(version),
  });
}
async function readRecord(
  executor: MutationDatabaseExecutor,
  sourceId: string,
  projectId: string,
) {
  const [row] = await executor
    .select()
    .from(source)
    .innerJoin(
      sourceVersion,
      and(
        eq(source.id, sourceVersion.sourceId),
        eq(source.revision, sourceVersion.revision),
      ),
    )
    .where(and(eq(source.id, sourceId), eq(source.projectId, projectId)));
  return row ? toRecord(row.source, row.source_version) : null;
}

function sourceTarget(
  accountId: string,
  projectId: string,
): MutationDatabaseTargetAdapter<SourceMutationValue> {
  return {
    async find(executor, targetId, lock) {
      if (!(await ownedProject(executor, accountId, projectId, lock))) {
        return null;
      }
      // The Project lock serializes creation and appending with archive/deletion.
      const [identity] = await executor
        .select()
        .from(source)
        .where(eq(source.id, targetId));
      if (identity && identity.projectId !== projectId) {
        return null;
      }
      const record = identity
        ? await readRecord(executor, targetId, projectId)
        : null;
      return {
        id: targetId,
        revision: identity?.revision ?? 0,
        value: { record },
      };
    },
    async update(executor, input) {
      const { record } = input.nextValue;
      if (
        !record ||
        record.id !== input.targetId ||
        record.projectId !== projectId ||
        !(await ownedProject(executor, accountId, projectId, true))
      ) {
        return null;
      }
      const values = {
        revision: input.expectedRevision + 1,
        updatedAt: input.committedAt,
      };
      const rows =
        input.expectedRevision === 0
          ? await executor
              .insert(source)
              .values({
                ...values,
                id: record.id,
                projectId,
                createdAt: input.committedAt,
              })
              .onConflictDoNothing({ target: source.id })
              .returning()
          : await executor
              .update(source)
              .set(values)
              .where(
                and(
                  eq(source.id, record.id),
                  eq(source.projectId, projectId),
                  eq(source.revision, input.expectedRevision),
                ),
              )
              .returning();
      const [identity] = rows;
      if (!identity) {
        return null;
      }
      const [version] = await executor
        .insert(sourceVersion)
        .values({
          ...record.version,
          accessedAt: new Date(record.version.accessedAt),
          savedAt: input.committedAt,
        })
        .returning();
      if (!version) {
        throw new Error("Source version was not saved.");
      }
      return {
        id: record.id,
        revision: identity.revision,
        value: { record: toRecord(identity, version) },
      };
    },
  };
}

function rethrowSourceError(error: unknown, targetId: string): never {
  if (error instanceof MutationApplyFailedError) {
    return rethrowSourceError(error.cause, targetId);
  }
  if (
    error instanceof MutationConflictError ||
    error instanceof MutationStaleBaseRevisionError
  ) {
    throw new SourceConflictError(targetId, { cause: error });
  }
  throw error;
}

export function createDatabaseSourcesAndFreshness(
  database: Database,
): SourcesAndFreshnessAccess {
  async function save(
    accountId: string,
    rawInput:
      | Parameters<SourcesAndFreshnessAccess["create"]>[1]
      | Parameters<SourcesAndFreshnessAccess["saveVersion"]>[1],
    creating: boolean,
  ) {
    const input = creating
      ? createSourceInputSchema.parse(rawInput)
      : saveSourceVersionInputSchema.parse(rawInput);
    const targetId = "id" in input ? input.id : input.sourceId;
    const { baseRevision, clientIdempotencyKey, projectId, ...capture } = input;
    // Recheck/fetch adapters must explicitly call this save boundary after approval.
    const mutation = createDatabaseMutationContract<SourceMutationValue>(
      database,
      { target: sourceTarget(accountId, projectId) },
    );
    try {
      const receipt = await mutation.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          targetId,
          baseRevision,
          clientIdempotencyKey,
          payload: {
            operation: creating ? "createSource" : "saveSourceVersion",
            ...input,
          },
        },
        ({
          currentValue,
          currentRevision,
          committedAt,
        }): SourceMutationValue => {
          if (
            creating
              ? currentValue.record !== null
              : currentValue.record === null
          ) {
            throw new MutationConflictError(targetId);
          }
          const version = sourceVersionSchema.parse({
            url: capture.url,
            title: capture.title,
            accessedAt: capture.accessedAt,
            capturedContent: capture.capturedContent,
            provider: capture.provider,
            externalRecordType: capture.externalRecordType,
            externalId: capture.externalId,
            sourceId: targetId,
            revision: currentRevision + 1,
            savedAt: committedAt,
          });
          return {
            record: {
              id: targetId,
              projectId,
              sourceType: "Source",
              revision: currentRevision + 1,
              createdAt: currentValue.record?.createdAt ?? committedAt,
              updatedAt: committedAt,
              version,
            },
          };
        },
      );
      return receipt.nextValue.record;
    } catch (error) {
      if (error instanceof MutationTargetNotFoundError) {
        return null;
      }
      return rethrowSourceError(error, targetId);
    }
  }
  return {
    create: (accountId, input) => save(accountId, input, true),
    saveVersion: (accountId, input) => save(accountId, input, false),
    find(accountId, rawInput) {
      const input = sourceSelectionSchema.parse(rawInput);
      return database.transaction(
        async (executor) => {
          const owned = await ownedProject(
            executor,
            accountId,
            input.projectId,
            false,
          );
          if (!owned) {
            return null;
          }
          const record = await readRecord(
            executor,
            input.sourceId,
            input.projectId,
          );
          if (!record) {
            return null;
          }
          const rows = await executor
            .select()
            .from(sourceVersion)
            .where(eq(sourceVersion.sourceId, input.sourceId))
            .orderBy(asc(sourceVersion.revision));
          return {
            record,
            versions: rows.map(toVersion),
            readOnly: owned.archivedAt !== null,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    list(accountId, projectId) {
      const input = sourceProjectInputSchema.parse({ projectId });
      return database.transaction(
        async (executor) => {
          const owned = await ownedProject(
            executor,
            accountId,
            input.projectId,
            false,
          );
          if (!owned) {
            return null;
          }
          const rows = await executor
            .select()
            .from(source)
            .innerJoin(
              sourceVersion,
              and(
                eq(source.id, sourceVersion.sourceId),
                eq(source.revision, sourceVersion.revision),
              ),
            )
            .where(eq(source.projectId, input.projectId))
            .orderBy(asc(source.createdAt), asc(source.id));
          return {
            records: rows.map((row) =>
              toRecord(row.source, row.source_version),
            ),
            readOnly: owned.archivedAt !== null,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
