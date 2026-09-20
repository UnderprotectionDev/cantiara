import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import {
  type UsageLink,
  type UsageLinkMutationContracts,
  type UsageLinkMutationValue,
  type UsageLinksAccess,
  usageLinkPayloadSchema,
  usageLinkSchema,
} from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { usageLink } from "@cantiara/db/schema/relation";
import { and, asc, eq } from "drizzle-orm";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

type UsageLinkDatabaseRecord = typeof usageLink.$inferSelect;

function toUsageLink(record: UsageLinkDatabaseRecord): UsageLink {
  return usageLinkSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    kind: record.kind,
    ...(record.location === null ? {} : { location: record.location }),
    revision: record.revision,
    source: {
      recordId: record.sourceRecordId,
      recordType: record.sourceRecordType,
    },
    surface: {
      recordId: record.surfaceRecordId,
      recordType: record.surfaceRecordType,
    },
  });
}

async function findWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function findOwnedUsageLink(
  executor: MutationDatabaseExecutor,
  accountId: string,
  usageLinkId: string,
  lock: boolean,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select({ link: usageLink })
    .from(usageLink)
    .where(
      and(
        eq(usageLink.id, usageLinkId),
        eq(usageLink.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0]?.link ?? null;
}

async function insertUsageLink(
  executor: MutationDatabaseExecutor,
  workspaceId: string,
  input: {
    committedAt: Date;
    id: string;
    payload: UsageLink;
  },
) {
  const [created] = await executor
    .insert(usageLink)
    .values({
      createdAt: input.committedAt,
      id: input.id,
      kind: input.payload.kind,
      location: input.payload.location ?? null,
      revision: input.payload.revision,
      sourceRecordId: input.payload.source.recordId,
      sourceRecordType: input.payload.source.recordType,
      surfaceRecordId: input.payload.surface.recordId,
      surfaceRecordType: input.payload.surface.recordType,
      workspaceId,
    })
    .returning();
  return created ? toUsageLink(created) : null;
}

export function createDatabaseUsageLinks(database: Database): UsageLinksAccess {
  return {
    async create(accountId, input) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        throw new Error("Workspace is unavailable.");
      }
      const payload = usageLinkPayloadSchema.parse(input);
      const timestamp = new Date();
      const [created] = await database
        .insert(usageLink)
        .values({
          createdAt: timestamp,
          id: crypto.randomUUID(),
          kind: payload.kind,
          location: payload.location ?? null,
          revision: 1,
          sourceRecordId: payload.source.recordId,
          sourceRecordType: payload.source.recordType,
          surfaceRecordId: payload.surface.recordId,
          surfaceRecordType: payload.surface.recordType,
          workspaceId,
        })
        .returning();
      if (!created) {
        throw new Error("Usage link could not be created.");
      }
      return toUsageLink(created);
    },

    async find(accountId, usageLinkId) {
      const record = await findOwnedUsageLink(
        database,
        accountId,
        usageLinkId,
        false,
      );
      return record ? toUsageLink(record) : null;
    },

    async listBySource(accountId, source) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      const records = await database
        .select()
        .from(usageLink)
        .where(
          and(
            eq(usageLink.workspaceId, workspaceId),
            eq(usageLink.sourceRecordId, source.recordId),
            eq(usageLink.sourceRecordType, source.recordType),
          ),
        )
        .orderBy(asc(usageLink.createdAt), asc(usageLink.id));
      return records.map(toUsageLink);
    },

    async unlink(accountId, usageLinkId) {
      const workspaceId = await findWorkspaceId(database, accountId);
      if (!workspaceId) {
        return false;
      }
      const deleted = await database
        .delete(usageLink)
        .where(
          and(
            eq(usageLink.id, usageLinkId),
            eq(usageLink.workspaceId, workspaceId),
          ),
        )
        .returning({ id: usageLink.id });
      return deleted.length > 0;
    },
  };
}

function emptyUsageLinkTarget(
  targetId: string,
): MutationTarget<UsageLinkMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { usageLink: null },
  };
}

function createUsageLinkCreateTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<UsageLinkMutationValue> {
  return {
    async find(executor, targetId, _lock, context) {
      const parsed = usageLinkPayloadSchema.safeParse(context?.payload);
      if (!(parsed.success && (await findWorkspaceId(executor, accountId)))) {
        return null;
      }
      return emptyUsageLinkTarget(targetId);
    },

    async update(executor, input) {
      const workspaceId = await findWorkspaceId(executor, accountId);
      const next = input.nextValue.usageLink;
      if (!(workspaceId && next)) {
        return null;
      }
      const parsed = usageLinkSchema.parse(next);
      const created = await insertUsageLink(executor, workspaceId, {
        committedAt: input.committedAt,
        id: parsed.id,
        payload: parsed,
      });
      return created
        ? {
            id: input.targetId,
            revision: created.revision,
            value: { usageLink: created },
          }
        : null;
    },
  };
}

function createUsageLinkUnlinkTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<UsageLinkMutationValue> {
  return {
    async find(executor, targetId, lock) {
      const record = await findOwnedUsageLink(
        executor,
        accountId,
        targetId,
        lock,
      );
      return record
        ? {
            id: record.id,
            revision: record.revision,
            value: { usageLink: toUsageLink(record) },
          }
        : null;
    },

    async update(executor, input) {
      if (input.nextValue.usageLink !== null) {
        return null;
      }
      const workspaceId = await findWorkspaceId(executor, accountId);
      if (!workspaceId) {
        return null;
      }
      const [deleted] = await executor
        .delete(usageLink)
        .where(
          and(
            eq(usageLink.id, input.targetId),
            eq(usageLink.workspaceId, workspaceId),
            eq(usageLink.revision, input.expectedRevision),
          ),
        )
        .returning({ id: usageLink.id });
      return deleted
        ? {
            id: input.targetId,
            revision: input.expectedRevision + 1,
            value: { usageLink: null },
          }
        : null;
    },
  };
}

export function createDatabaseUsageLinkMutationContracts(
  database: Database,
): UsageLinkMutationContracts {
  return {
    create: (accountId) =>
      createDatabaseMutationContract<UsageLinkMutationValue>(database, {
        target: createUsageLinkCreateTarget(accountId),
      }),
    unlink: (accountId) =>
      createDatabaseMutationContract<UsageLinkMutationValue>(database, {
        target: createUsageLinkUnlinkTarget(accountId),
      }),
  };
}
