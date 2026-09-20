import {
  type Tag,
  type TagAssignment,
  type TagInlineRenameWriter,
  type TagMutationContracts,
  type TagMutationValue,
  type TagRecord,
  type TagRenameAccess,
  type TagStore,
  type TagSuggestion,
  tagAssignmentSchema,
  tagNameKey,
  tagRecordSchema,
  tagSchema,
} from "@cantiara/api/tags";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { workspaceTag, workspaceTagAssignment } from "@cantiara/db/schema/tags";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createTags,
  TagNameConflictError,
  TagNotFoundError,
  TagProjectNotFoundError,
  TagRecordNotFoundError,
  TagRevisionConflictError,
  TagWorkspaceNotFoundError,
} from "./tags";

type WorkspaceTagDatabaseRecord = typeof workspaceTag.$inferSelect;
type TagAssignmentDatabaseRecord = typeof workspaceTagAssignment.$inferSelect;

export type TagDatabaseExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;

function toTag(record: WorkspaceTagDatabaseRecord): Tag {
  return tagSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toTagAssignment(record: TagAssignmentDatabaseRecord): TagAssignment {
  return tagAssignmentSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    recordId: record.recordId,
    recordType: record.recordType,
    tagId: record.tagId,
  });
}

function toTagRecord(
  record: typeof work.$inferSelect,
  tags: readonly Tag[],
): TagRecord {
  return tagRecordSchema.parse({
    archivedAt: record.archivedAt?.toISOString() ?? null,
    id: record.id,
    key: record.key,
    projectId: record.projectId,
    recordType: "Work",
    tags,
    title: record.title,
  });
}

async function findWorkspaceId(
  database: Pick<Database, "select">,
  accountId: string,
) {
  const [record] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function findOwnedProject(
  database: Pick<Database, "select">,
  workspaceId: string,
  projectId: string,
) {
  const [record] = await database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  return record ?? null;
}

async function findWorkspaceTag(
  database: Pick<Database, "select">,
  workspaceId: string,
  tagId: string,
  lock = false,
) {
  const query = database
    .select()
    .from(workspaceTag)
    .where(
      and(
        eq(workspaceTag.id, tagId),
        eq(workspaceTag.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

async function findOwnedWork(
  database: Pick<Database, "select">,
  workspaceId: string,
  projectId: string,
  workId: string,
) {
  const [result] = await database
    .select({ record: work })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(
      and(
        eq(work.id, workId),
        eq(work.projectId, projectId),
        eq(project.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return result?.record ?? null;
}

async function listRecordTags(
  database: Pick<Database, "select">,
  workspaceId: string,
  recordIds: readonly string[],
) {
  if (recordIds.length === 0) {
    return new Map<string, Tag[]>();
  }

  const assignments = await database
    .select({ assignment: workspaceTagAssignment, tag: workspaceTag })
    .from(workspaceTagAssignment)
    .innerJoin(
      workspaceTag,
      and(
        eq(workspaceTag.id, workspaceTagAssignment.tagId),
        eq(workspaceTag.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(workspaceTagAssignment.recordType, "Work"),
        inArray(workspaceTagAssignment.recordId, [...recordIds]),
      ),
    )
    .orderBy(asc(workspaceTag.createdAt), asc(workspaceTag.nameKey));

  const tagsByRecord = new Map<string, Tag[]>();
  for (const { assignment, tag } of assignments) {
    const recordTags = tagsByRecord.get(assignment.recordId) ?? [];
    recordTags.push(toTag(tag));
    tagsByRecord.set(assignment.recordId, recordTags);
  }
  return tagsByRecord;
}

function toTagMutationTarget(record: WorkspaceTagDatabaseRecord): {
  id: string;
  revision: number;
  value: TagMutationValue;
} {
  return {
    id: record.id,
    revision: record.revision,
    value: { tag: toTag(record) },
  };
}

function createTagRenameMutationTarget(
  accountId: string,
  inlineRename: TagInlineRenameWriter<TagDatabaseExecutor> | undefined,
): MutationDatabaseTargetAdapter<TagMutationValue> {
  return {
    async find(executor, targetId, lock) {
      const workspaceId = await findWorkspaceId(executor, accountId);
      if (!workspaceId) {
        throw new TagWorkspaceNotFoundError();
      }
      const record = await findWorkspaceTag(
        executor,
        workspaceId,
        targetId,
        lock,
      );
      return record ? toTagMutationTarget(record) : null;
    },

    async update(executor, input) {
      const workspaceId = await findWorkspaceId(executor, accountId);
      if (!workspaceId) {
        throw new TagWorkspaceNotFoundError();
      }
      const current = await findWorkspaceTag(
        executor,
        workspaceId,
        input.targetId,
        true,
      );
      if (!current) {
        return null;
      }
      const next = input.nextValue.tag;
      if (!next || next.id !== current.id) {
        return null;
      }

      const [nameConflict] = await executor
        .select({ id: workspaceTag.id })
        .from(workspaceTag)
        .where(
          and(
            eq(workspaceTag.workspaceId, workspaceId),
            eq(workspaceTag.nameKey, tagNameKey(next.name)),
            sql`${workspaceTag.id} <> ${input.targetId}`,
          ),
        )
        .limit(1);
      if (nameConflict) {
        throw new TagNameConflictError(next.name);
      }

      const [updated] = await executor
        .update(workspaceTag)
        .set({
          name: next.name,
          nameKey: tagNameKey(next.name),
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(workspaceTag.id, input.targetId),
            eq(workspaceTag.workspaceId, workspaceId),
            eq(workspaceTag.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (!updated) {
        return null;
      }

      await inlineRename?.renameInlineUses(executor, {
        committedAt: input.committedAt.toISOString(),
        nextName: updated.name,
        previousName: current.name,
        tagId: updated.id,
        workspaceId,
      });

      return toTagMutationTarget(updated);
    },
  };
}

function createDatabaseTagRename(
  database: Database,
  options: {
    inlineRename?: TagInlineRenameWriter<TagDatabaseExecutor>;
  },
): TagRenameAccess {
  return async (accountId, input) => {
    const workspaceId = await findWorkspaceId(database, accountId);
    if (!workspaceId) {
      throw new TagWorkspaceNotFoundError();
    }
    const current = await findWorkspaceTag(database, workspaceId, input.tagId);
    if (
      current &&
      current.name === input.name &&
      (input.expectedRevision === undefined ||
        input.expectedRevision === current.revision)
    ) {
      return toTag(current);
    }

    const mutation = createDatabaseTagMutationContracts(
      database,
      options,
    ).rename(accountId);
    const baseRevision = input.expectedRevision ?? current?.revision ?? 0;
    let receipt: Awaited<ReturnType<typeof mutation.mutate>>;
    try {
      receipt = await mutation.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          kind: "human",
          payload: input,
          targetId: input.tagId,
        },
        ({ currentValue, currentRevision, payload }) => {
          if (!currentValue.tag) {
            throw new TagNotFoundError(input.tagId);
          }
          return {
            tag: {
              ...currentValue.tag,
              name: payload.name,
              revision: currentRevision + 1,
              updatedAt: new Date().toISOString(),
            },
          } satisfies TagMutationValue;
        },
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "STALE_BASE_REVISION"
      ) {
        throw new TagRevisionConflictError(input.tagId, { cause: error });
      }
      throw error;
    }
    if (!receipt.nextValue.tag) {
      throw new TagNotFoundError(input.tagId);
    }
    return receipt.nextValue.tag;
  };
}

export function createDatabaseTags(
  database: Database,
  options: {
    inlineRename?: TagInlineRenameWriter<TagDatabaseExecutor>;
  } = {},
) {
  const store: TagStore = {
    async apply(workspaceId, input) {
      const tag = await findWorkspaceTag(database, workspaceId, input.tagId);
      if (!tag) {
        throw new TagNotFoundError(input.tagId);
      }
      const record = await findOwnedWork(
        database,
        workspaceId,
        input.projectId,
        input.recordId,
      );
      if (!record) {
        throw new TagRecordNotFoundError(input.recordId);
      }

      const [inserted] = await database
        .insert(workspaceTagAssignment)
        .values({
          id: crypto.randomUUID(),
          recordId: input.recordId,
          recordType: input.recordType,
          tagId: input.tagId,
        })
        .onConflictDoNothing({
          target: [
            workspaceTagAssignment.tagId,
            workspaceTagAssignment.recordType,
            workspaceTagAssignment.recordId,
          ],
        })
        .returning();

      if (inserted) {
        return toTagAssignment(inserted);
      }

      const [existing] = await database
        .select()
        .from(workspaceTagAssignment)
        .where(
          and(
            eq(workspaceTagAssignment.tagId, input.tagId),
            eq(workspaceTagAssignment.recordId, input.recordId),
            eq(workspaceTagAssignment.recordType, input.recordType),
          ),
        )
        .limit(1);
      return existing ? toTagAssignment(existing) : null;
    },

    async create(workspaceId, input) {
      const [created] = await database
        .insert(workspaceTag)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          nameKey: tagNameKey(input.name),
          workspaceId,
        })
        .onConflictDoNothing({
          target: [workspaceTag.workspaceId, workspaceTag.nameKey],
        })
        .returning();
      if (!created) {
        throw new TagNameConflictError(input.name);
      }
      return toTag(created);
    },

    findWorkspaceId(accountId) {
      return findWorkspaceId(database, accountId);
    },

    async list(workspaceId, projectId) {
      const ownedProject = await findOwnedProject(
        database,
        workspaceId,
        projectId,
      );
      if (!ownedProject) {
        throw new TagProjectNotFoundError(projectId);
      }

      const [tags, usage] = await Promise.all([
        database
          .select()
          .from(workspaceTag)
          .where(eq(workspaceTag.workspaceId, workspaceId))
          .orderBy(asc(workspaceTag.createdAt), asc(workspaceTag.nameKey)),
        database
          .select({
            tagId: workspaceTagAssignment.tagId,
            total: sql<number>`cast(count(*) as int)`,
          })
          .from(workspaceTagAssignment)
          .innerJoin(
            workspaceTag,
            and(
              eq(workspaceTag.id, workspaceTagAssignment.tagId),
              eq(workspaceTag.workspaceId, workspaceId),
            ),
          )
          .innerJoin(work, eq(workspaceTagAssignment.recordId, work.id))
          .where(
            and(
              eq(workspaceTagAssignment.recordType, "Work"),
              eq(work.projectId, projectId),
            ),
          )
          .groupBy(workspaceTagAssignment.tagId),
      ]);
      const usageByTagId = new Map(
        usage.map((item) => [item.tagId, item.total]),
      );

      return tags.map(
        (record) =>
          ({
            projectUsageCount: usageByTagId.get(record.id) ?? 0,
            tag: toTag(record),
          }) satisfies TagSuggestion,
      );
    },

    async listRecords(workspaceId, input) {
      const ownedProject = await findOwnedProject(
        database,
        workspaceId,
        input.projectId,
      );
      if (!ownedProject) {
        throw new TagProjectNotFoundError(input.projectId);
      }

      if (input.tagId) {
        const tag = await findWorkspaceTag(database, workspaceId, input.tagId);
        if (!tag) {
          throw new TagNotFoundError(input.tagId);
        }
      }

      const records = await database
        .select({ record: work })
        .from(work)
        .where(
          and(
            eq(work.projectId, input.projectId),
            input.tagId
              ? inArray(
                  work.id,
                  database
                    .select({ id: workspaceTagAssignment.recordId })
                    .from(workspaceTagAssignment)
                    .where(
                      and(
                        eq(workspaceTagAssignment.tagId, input.tagId),
                        eq(workspaceTagAssignment.recordType, "Work"),
                      ),
                    ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(work.number));
      const tagsByRecord = await listRecordTags(
        database,
        workspaceId,
        records.map(({ record }) => record.id),
      );
      return records.map(({ record }) =>
        toTagRecord(record, tagsByRecord.get(record.id) ?? []),
      );
    },

    async remove(workspaceId, input) {
      const tag = await findWorkspaceTag(database, workspaceId, input.tagId);
      if (!tag) {
        throw new TagNotFoundError(input.tagId);
      }
      const record = await findOwnedWork(
        database,
        workspaceId,
        input.projectId,
        input.recordId,
      );
      if (!record) {
        throw new TagRecordNotFoundError(input.recordId);
      }
      await database
        .delete(workspaceTagAssignment)
        .where(
          and(
            eq(workspaceTagAssignment.tagId, input.tagId),
            eq(workspaceTagAssignment.recordId, input.recordId),
            eq(workspaceTagAssignment.recordType, input.recordType),
          ),
        );
      return { status: true };
    },
  };

  return createTags({
    rename: createDatabaseTagRename(database, options),
    store,
  });
}

export function createDatabaseTagMutationContracts(
  database: Database,
  options: {
    inlineRename?: TagInlineRenameWriter<TagDatabaseExecutor>;
  } = {},
): TagMutationContracts {
  return {
    rename: (accountId) =>
      createDatabaseMutationContract<TagMutationValue>(database, {
        target: createTagRenameMutationTarget(accountId, options.inlineRename),
      }),
  };
}
