import type { StoredAttentionSignal } from "@cantiara/api/attention-signals";
import type { Database } from "@cantiara/db";
import {
  attentionSignal,
  attentionSignalFollowUp,
} from "@cantiara/db/schema/attention-signals";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray } from "drizzle-orm";

import {
  type AttentionSignalStore,
  type AttentionSourceResolver,
  createAttentionSignals,
} from "./attention-signals";

type Executor = Pick<Database, "insert" | "select" | "update">;

/** Inserts the one follow-up Work under the locked Project; wired by the server root. */
export interface AttentionFollowUpPorts {
  insertWork: (
    executor: Executor,
    owner: typeof project.$inferSelect,
    input: {
      committedAt: Date;
      description: string;
      idempotencyKey: string;
      originOwnerRecordId: string;
      payloadFingerprint: string;
      title: string;
      type: string;
      workId: string;
    },
  ) => Promise<string>;
}

const toStored = (
  row: typeof attentionSignal.$inferSelect,
): StoredAttentionSignal => ({
  closedAt: row.closedAt?.toISOString() ?? null,
  eventId: row.eventId,
  group: { id: row.groupId, kind: row.groupKind },
  id: row.id,
  occurredAt: row.occurredAt.toISOString(),
  projectId: row.projectId,
  readAt: row.readAt?.toISOString() ?? null,
  reason: row.reason,
  signalId: row.signalId as StoredAttentionSignal["signalId"],
  targetId: row.targetId,
});

export function createDatabaseAttentionSignalStore(
  database: Database,
  ports: AttentionFollowUpPorts,
): AttentionSignalStore {
  return {
    async commitFollowUp(accountId, commit) {
      return await database.transaction(async (executor) => {
        const [prior] = await executor
          .select()
          .from(attentionSignalFollowUp)
          .where(eq(attentionSignalFollowUp.attemptId, commit.attemptId));
        if (prior) {
          return prior.accountId === accountId &&
            prior.signalRowId === commit.signal.id
            ? { outcome: "duplicate", workId: prior.workId }
            : { outcome: "attemptConflict" };
        }
        const { projectId } = commit.signal;
        if (!projectId) {
          return { outcome: "projectUnavailable" };
        }
        const [owned] = await executor
          .select({ project })
          .from(project)
          .innerJoin(workspace, eq(project.workspaceId, workspace.id))
          .where(
            and(
              eq(project.id, projectId),
              eq(workspace.ownerAccountId, accountId),
            ),
          )
          .limit(1)
          .for("update", { of: project });
        if (!owned || owned.project.archivedAt) {
          return { outcome: "projectUnavailable" };
        }
        const committedAt = new Date();
        await ports.insertWork(executor, owned.project, {
          committedAt,
          description: commit.plan.description,
          idempotencyKey: `attention-follow-up:${commit.attemptId}`,
          originOwnerRecordId: commit.signal.id,
          payloadFingerprint: commit.fingerprint,
          title: commit.plan.title,
          type: commit.plan.type,
          workId: commit.workId,
        });
        const source = commit.plan.relations.find(
          (relation) => relation.kind !== "Notification",
        );
        await executor.insert(attentionSignalFollowUp).values({
          accountId,
          attemptId: commit.attemptId,
          createdAt: committedAt,
          fingerprint: commit.fingerprint,
          projectId,
          signalRowId: commit.signal.id,
          sourceGroupId: source?.id ?? null,
          sourceGroupKind: source?.kind ?? null,
          workId: commit.workId,
        });
        return { outcome: "created", workId: commit.workId };
      });
    },

    async find(accountId, signalRowId) {
      const [row] = await database
        .select()
        .from(attentionSignal)
        .where(
          and(
            eq(attentionSignal.accountId, accountId),
            eq(attentionSignal.id, signalRowId),
          ),
        );
      return row ? toStored(row) : null;
    },

    async insertIfAbsent(accountId, signal) {
      const [inserted] = await database
        .insert(attentionSignal)
        .values({
          accountId,
          eventId: signal.eventId,
          groupId: signal.group.id,
          groupKind: signal.group.kind,
          id: signal.id,
          occurredAt: new Date(signal.occurredAt),
          projectId: signal.projectId,
          reason: signal.reason,
          signalId: signal.signalId,
          targetId: signal.targetId,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        return { created: true, signal: toStored(inserted) };
      }
      const [existing] = await database
        .select()
        .from(attentionSignal)
        .where(
          and(
            eq(attentionSignal.accountId, accountId),
            eq(attentionSignal.signalId, signal.signalId),
            eq(attentionSignal.eventId, signal.eventId),
            eq(attentionSignal.targetId, signal.targetId),
          ),
        );
      if (!existing) {
        throw new Error(
          "Attention signal vanished after a conflicting insert.",
        );
      }
      return { created: false, signal: toStored(existing) };
    },

    async list(accountId) {
      const rows = await database
        .select()
        .from(attentionSignal)
        .where(eq(attentionSignal.accountId, accountId));
      return rows.map(toStored);
    },

    async setMarks(accountId, signalRowId, marks) {
      const [row] = await database
        .update(attentionSignal)
        .set({
          ...(marks.closedAt === undefined
            ? {}
            : { closedAt: marks.closedAt ? new Date(marks.closedAt) : null }),
          ...(marks.readAt === undefined
            ? {}
            : { readAt: marks.readAt ? new Date(marks.readAt) : null }),
        })
        .where(
          and(
            eq(attentionSignal.accountId, accountId),
            eq(attentionSignal.id, signalRowId),
          ),
        )
        .returning();
      return row ? toStored(row) : null;
    },
  };
}

const RECORD_TABLES = {
  Decision: decision,
  Document: document,
  Risk: risk,
  Work: work,
} as const;

/**
 * Existence for one known record kind over a batch of ids: the ids that are
 * missing, or for Work trashed, as `kind:id` keys. Unknown kinds report present.
 */
async function deletedKeysForKind(
  database: Database,
  kind: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }
  if (kind === "Work") {
    const rows = await database
      .select({ id: work.id, trashedAt: work.trashedAt })
      .from(work)
      .where(inArray(work.id, ids));
    const live = new Set(
      rows.filter((row) => !row.trashedAt).map((row) => row.id),
    );
    return ids.filter((id) => !live.has(id)).map((id) => `Work:${id}`);
  }
  const table = RECORD_TABLES[kind as keyof typeof RECORD_TABLES];
  const present = await database
    .select({ id: table.id })
    .from(table)
    .where(inArray(table.id, ids));
  const found = new Set(present.map((row) => row.id));
  return ids.filter((id) => !found.has(id)).map((id) => `${kind}:${id}`);
}

/**
 * Existence-only resolver over the owner tables this slice can read. A kind it
 * does not know is reported present; events resolve only for a producer that
 * supplies its own event resolver. It reads no content. `records` is the batch
 * form: one existence query per known kind, never one per group.
 */
export function createDatabaseSourceResolver(
  database: Database,
  events: AttentionSourceResolver["event"] = () =>
    Promise.resolve("unresolved"),
): AttentionSourceResolver {
  return {
    event: events,
    async records(_accountId, groups) {
      const idsByKind = new Map<string, string[]>();
      for (const group of groups) {
        const ids = idsByKind.get(group.kind) ?? [];
        ids.push(group.id);
        idsByKind.set(group.kind, ids);
      }
      const deleted = await Promise.all(
        [...idsByKind]
          .filter(([kind]) => Object.hasOwn(RECORD_TABLES, kind))
          .map(([kind, ids]) => deletedKeysForKind(database, kind, ids)),
      );
      return new Set(deleted.flat());
    },
    async record(_accountId, group) {
      if (!Object.hasOwn(RECORD_TABLES, group.kind)) {
        return "present";
      }
      const table = RECORD_TABLES[group.kind as keyof typeof RECORD_TABLES];
      const [row] = await database
        .select({ id: table.id })
        .from(table)
        .where(eq(table.id, group.id))
        .limit(1);
      if (!row) {
        return "deleted";
      }
      if (group.kind === "Work") {
        const [trashed] = await database
          .select({ trashedAt: work.trashedAt })
          .from(work)
          .where(eq(work.id, group.id))
          .limit(1);
        return trashed?.trashedAt ? "deleted" : "present";
      }
      return "present";
    },
  };
}

export function createDatabaseAttentionSignals(
  database: Database,
  ports: AttentionFollowUpPorts,
) {
  return createAttentionSignals(
    createDatabaseAttentionSignalStore(database, ports),
    { resolver: createDatabaseSourceResolver(database) },
  );
}
