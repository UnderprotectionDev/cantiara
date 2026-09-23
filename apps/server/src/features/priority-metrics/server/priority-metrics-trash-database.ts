import type { Database } from "@cantiara/db";
import { auditRecord } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { priorityMetricDefinition } from "@cantiara/db/schema/priority-metrics";
import { securityEvent } from "@cantiara/db/schema/security-event";
import type { SecurityEventDatabase } from "@cantiara/db/security-events";
import { and, asc, eq, like, lte, ne, or } from "drizzle-orm";
import type { MutationIdempotencyKey } from "../../mutation-and-undo/server/mutation-contract";

export const PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE =
  "priority-metric.permanently-deleted";
export const PRIORITY_METRIC_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRIORITY_METRIC_DELETE_REVISION_PATTERN = /^r(0|[1-9]\d*):p[a-f\d]{64}$/;

export async function priorityMetricPermanentDeleteEventKeyPrefix(
  metricId: string,
  idempotencyKey: MutationIdempotencyKey,
) {
  const encodedKey = new TextEncoder().encode(
    `${idempotencyKey.scope}\0${idempotencyKey.key}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", encodedKey);
  const keyFingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `priority-metric-delete:${metricId}:i${keyFingerprint}:`;
}

export async function priorityMetricPermanentDeleteEventId(
  metricId: string,
  revision: number,
  idempotencyKey: MutationIdempotencyKey,
  payloadFingerprint: string,
) {
  const keyPrefix = await priorityMetricPermanentDeleteEventKeyPrefix(
    metricId,
    idempotencyKey,
  );
  return `${keyPrefix}r${revision}:p${payloadFingerprint}`;
}

export function priorityMetricPermanentDeleteEventRevision(
  eventId: string,
  keyPrefix: string,
) {
  const match = PRIORITY_METRIC_DELETE_REVISION_PATTERN.exec(
    eventId.slice(keyPrefix.length),
  );
  if (!match) {
    return null;
  }
  const revision = Number(match[1]);
  return Number.isSafeInteger(revision) ? revision : null;
}

export interface PriorityMetricPermanentDeleteEvent {
  actorAlias: string;
  id: string;
  occurredAt: string;
  targetAlias: string;
  type: typeof PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE;
  version: 1;
}

export interface PriorityMetricPermanentDeleteEventStore {
  append: (event: PriorityMetricPermanentDeleteEvent) => Promise<void>;
  list: () => Promise<PriorityMetricPermanentDeleteEvent[]>;
}

type PriorityMetricTrashExecutor = Pick<
  Database,
  "delete" | "insert" | "select"
>;

export function createDatabasePriorityMetricPermanentDeleteEvents(
  database: SecurityEventDatabase,
): PriorityMetricPermanentDeleteEventStore {
  return {
    async append(event) {
      await database
        .insert(securityEvent)
        .values({
          actorAlias: event.actorAlias,
          id: event.id,
          occurredAt: new Date(event.occurredAt),
          targetSessionAlias: event.targetAlias,
          type: event.type,
          version: event.version,
        })
        .onConflictDoNothing({ target: securityEvent.id });
    },
    async list() {
      const events = await database
        .select()
        .from(securityEvent)
        .where(
          eq(securityEvent.type, PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE),
        )
        .orderBy(asc(securityEvent.occurredAt));
      return events.map((event) => {
        if (event.version !== 1 || !event.targetSessionAlias) {
          throw new Error("Unsupported priority metric delete event.");
        }
        return {
          actorAlias: event.actorAlias,
          occurredAt: event.occurredAt.toISOString(),
          id: event.id,
          targetAlias: event.targetSessionAlias,
          type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
          version: 1,
        };
      });
    },
  };
}

function targetIdPredicate(metricId: string) {
  const escapedMetricId = metricId.replace(/[\\%_]/g, "\\$&");
  return or(
    eq(mutationReceipt.targetId, metricId),
    like(mutationReceipt.targetId, `%:${escapedMetricId}`),
  );
}

export async function erasePriorityMetricContent(
  executor: PriorityMetricTrashExecutor,
  {
    actorAlias,
    auditRecordId,
    expectedRevision,
    historyId,
    metricId,
    occurredAt,
  }: {
    actorAlias: string;
    auditRecordId: string;
    expectedRevision?: number;
    historyId?: string;
    metricId: string;
    occurredAt: Date;
  },
) {
  const [deleted] = await executor
    .delete(priorityMetricDefinition)
    .where(
      and(
        eq(priorityMetricDefinition.id, metricId),
        ...(expectedRevision === undefined
          ? []
          : [eq(priorityMetricDefinition.revision, expectedRevision)]),
      ),
    )
    .returning({ id: priorityMetricDefinition.id });
  if (expectedRevision !== undefined && !deleted) {
    return false;
  }

  await executor.delete(mutationReceipt).where(targetIdPredicate(metricId));
  await executor
    .delete(mutationHistory)
    .where(
      or(
        eq(mutationHistory.targetId, metricId),
        like(
          mutationHistory.targetId,
          `%:${metricId.replace(/[\\%_]/g, "\\$&")}`,
        ),
      ),
    );
  await executor
    .delete(mutationTarget)
    .where(
      or(
        eq(mutationTarget.id, metricId),
        like(mutationTarget.id, `%:${metricId.replace(/[\\%_]/g, "\\$&")}`),
      ),
    );
  const stagedMetricTargets = or(
    eq(mutationStaging.targetId, metricId),
    like(mutationStaging.targetId, `%:${metricId.replace(/[\\%_]/g, "\\$&")}`),
  );
  await executor
    .delete(mutationStaging)
    .where(
      historyId
        ? and(stagedMetricTargets, ne(mutationStaging.historyId, historyId))
        : stagedMetricTargets,
    );
  await executor
    .insert(auditRecord)
    .values({
      actorAlias,
      id: auditRecordId,
      occurredAt,
      targetSessionAlias: metricId,
      type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
    })
    .onConflictDoNothing({ target: auditRecord.id });
  return true;
}

export function createDatabasePriorityMetricTrashMaintenance(
  database: Database,
  events: PriorityMetricPermanentDeleteEventStore,
) {
  async function replayPermanentDeletes() {
    const eventsToReplay = await events.list();
    for (const event of eventsToReplay) {
      // biome-ignore lint/performance/noAwaitInLoops: Apply the protected replay in event order before the server accepts writes.
      await database.transaction(async (transaction) => {
        await erasePriorityMetricContent(transaction, {
          actorAlias: event.actorAlias,
          auditRecordId: `audit:${event.id}`,
          metricId: event.targetAlias,
          occurredAt: new Date(event.occurredAt),
        });
      });
    }
    return eventsToReplay.length;
  }

  return {
    replayPermanentDeletes,

    async sweepExpired(now = new Date()) {
      await replayPermanentDeletes();
      const cutoff = new Date(
        now.getTime() - PRIORITY_METRIC_TRASH_RETENTION_MS,
      );
      const candidates = await database
        .select({ id: priorityMetricDefinition.id })
        .from(priorityMetricDefinition)
        .where(lte(priorityMetricDefinition.trashedAt, cutoff));
      let deletedCount = 0;

      for (const candidate of candidates) {
        // biome-ignore lint/performance/noAwaitInLoops: Keep retention cleanup bounded to one cross-database event and primary transaction at a time.
        const deleted = await database.transaction(async (transaction) => {
          const [metric] = await transaction
            .select({
              id: priorityMetricDefinition.id,
              revision: priorityMetricDefinition.revision,
              trashedAt: priorityMetricDefinition.trashedAt,
            })
            .from(priorityMetricDefinition)
            .where(
              and(
                eq(priorityMetricDefinition.id, candidate.id),
                lte(priorityMetricDefinition.trashedAt, cutoff),
              ),
            )
            .limit(1)
            .for("update");
          if (!metric?.trashedAt) {
            return false;
          }

          const occurredAt = now.toISOString();
          const id = `priority-metric-expiry:${metric.id}:${metric.trashedAt.toISOString()}`;
          const event: PriorityMetricPermanentDeleteEvent = {
            actorAlias: "system:trash-retention",
            occurredAt,
            id,
            targetAlias: metric.id,
            type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
            version: 1,
          };
          await events.append(event);
          return erasePriorityMetricContent(transaction, {
            actorAlias: event.actorAlias,
            auditRecordId: `audit:${event.id}`,
            expectedRevision: metric.revision,
            metricId: metric.id,
            occurredAt: now,
          });
        });
        if (deleted) {
          deletedCount += 1;
        }
      }
      return deletedCount;
    },
  };
}
