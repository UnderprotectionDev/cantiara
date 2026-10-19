import type {
  Feed,
  FeedbackFeedStore,
  FeedRelatedRecord,
  FeedRow,
} from "@cantiara/api/feedback-feed";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import { feedback, feedbackWorkOrigin } from "@cantiara/db/schema/feedback";
import { workRelation } from "@cantiara/db/schema/relation";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { createFeedback } from "./feedback";
import {
  createDatabaseFeedbackStore,
  type FeedbackExecutor,
  findReadableProject,
  toRecords,
} from "./feedback-database";
import { createFeedbackFeed } from "./feedback-feed";

const RECORD_TYPES = ["Feedback", "Source"];

function addRelated(
  related: Map<string, FeedRelatedRecord[]>,
  rowId: string,
  record: FeedRelatedRecord,
) {
  const list = related.get(rowId) ?? [];
  if (!list.some(({ id, type }) => id === record.id && type === record.type)) {
    list.push(record);
  }
  related.set(rowId, list);
}

/** Existing relations only: Work-owned relations, `Origin` links and Evidence bindings that point away from the row. */
async function readRelated(
  executor: FeedbackExecutor,
  projectId: string,
  ids: string[],
) {
  const related = new Map<string, FeedRelatedRecord[]>();
  if (ids.length === 0) {
    return related;
  }
  const works = await executor
    .select({
      id: work.id,
      key: work.key,
      projectId: work.projectId,
      recordId: workRelation.targetRecordId,
      title: work.title,
    })
    .from(workRelation)
    .innerJoin(work, eq(work.id, workRelation.sourceWorkId))
    .where(
      and(
        inArray(workRelation.targetRecordId, ids),
        inArray(workRelation.targetRecordType, RECORD_TYPES),
        eq(workRelation.targetProjectId, projectId),
        isNull(workRelation.deletedAt),
        isNull(work.trashedAt),
      ),
    )
    .orderBy(asc(workRelation.createdAt), asc(workRelation.id));
  for (const row of works) {
    addRelated(related, row.recordId, {
      id: row.id,
      projectId: row.projectId,
      title: `${row.key} ${row.title}`,
      type: "Work",
    });
  }
  // The Work that Convert to Work created from the Feedback is its `Origin` link.
  const origins = await executor
    .select({
      feedbackId: feedbackWorkOrigin.feedbackId,
      id: work.id,
      key: work.key,
      projectId: work.projectId,
      title: work.title,
    })
    .from(feedbackWorkOrigin)
    .innerJoin(work, eq(work.id, feedbackWorkOrigin.workId))
    .where(
      and(inArray(feedbackWorkOrigin.feedbackId, ids), isNull(work.trashedAt)),
    )
    .orderBy(asc(feedbackWorkOrigin.createdAt), asc(feedbackWorkOrigin.id));
  for (const row of origins) {
    addRelated(related, row.feedbackId, {
      id: row.id,
      projectId: row.projectId,
      title: `${row.key} ${row.title}`,
      type: "Work",
    });
  }
  const bindings = await executor
    .select({
      recordId: evidenceBinding.sourceRecordId,
      targetId: evidenceBinding.targetRecordId,
      targetProjectId: evidenceBinding.targetProjectId,
      targetType: evidenceBinding.targetRecordType,
    })
    .from(evidenceBinding)
    .where(
      and(
        eq(evidenceBinding.sourceProjectId, projectId),
        inArray(evidenceBinding.sourceRecordId, ids),
        inArray(evidenceBinding.targetRecordType, ["Work", "Decision"]),
      ),
    )
    .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id));
  const workIds = bindings
    .filter(({ targetType }) => targetType === "Work")
    .map(({ targetId }) => targetId);
  const decisionIds = bindings
    .filter(({ targetType }) => targetType === "Decision")
    .map(({ targetId }) => targetId);
  const workTitles =
    workIds.length === 0
      ? []
      : await executor
          .select({ id: work.id, key: work.key, title: work.title })
          .from(work)
          .where(and(inArray(work.id, workIds), isNull(work.trashedAt)));
  const decisionTitles =
    decisionIds.length === 0
      ? []
      : await executor
          .select({ id: decision.id, title: decision.title })
          .from(decision)
          .where(inArray(decision.id, decisionIds));
  for (const binding of bindings) {
    if (!binding.targetProjectId) {
      continue;
    }
    const foundWork =
      binding.targetType === "Work"
        ? workTitles.find(({ id }) => id === binding.targetId)
        : undefined;
    const foundDecision =
      binding.targetType === "Decision"
        ? decisionTitles.find(({ id }) => id === binding.targetId)
        : undefined;
    if (foundWork) {
      addRelated(related, binding.recordId, {
        id: foundWork.id,
        projectId: binding.targetProjectId,
        title: `${foundWork.key} ${foundWork.title}`,
        type: "Work",
      });
    }
    if (foundDecision) {
      addRelated(related, binding.recordId, {
        id: foundDecision.id,
        projectId: binding.targetProjectId,
        title: foundDecision.title,
        type: "Decision",
      });
    }
  }
  return related;
}

/**
 * Read-only PostgreSQL adapter of the Feed. It only selects from
 * `project_feedback`, `source`/`source_version` and relation tables; it never
 * inserts, updates or rechecks a Source, which is shown at its saved version.
 */
export function createDatabaseFeedbackFeedStore(
  database: Database,
): FeedbackFeedStore {
  return {
    read(accountId, projectId): Promise<Feed | null> {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          if (!owned) {
            return null;
          }
          const feedbackRows = await executor
            .select()
            .from(feedback)
            .where(eq(feedback.projectId, owned.id))
            .orderBy(asc(feedback.id));
          const sourceRows = await executor
            .select()
            .from(source)
            .innerJoin(
              sourceVersion,
              and(
                eq(source.id, sourceVersion.sourceId),
                eq(source.revision, sourceVersion.revision),
              ),
            )
            .where(eq(source.projectId, owned.id))
            .orderBy(asc(source.id));
          const records = await toRecords(executor, feedbackRows);
          // Long-body Sources only: a Source without captured content has nothing to read.
          const longSources = sourceRows.filter(
            ({ source_version: version }) => version.capturedContent.length > 0,
          );
          const related = await readRelated(executor, owned.id, [
            ...records.map(({ id }) => id),
            ...longSources.map(({ source: { id } }) => id),
          ]);
          const rows: FeedRow[] = [
            ...records.map((record) => ({
              attachments: record.attachments,
              body: record.originalMessage,
              id: record.id,
              identity: record.channel,
              kind: "Feedback" as const,
              occurredAt: record.occurredAt,
              projectId: record.projectId,
              related: related.get(record.id) ?? [],
              status: record.status,
              title: record.title,
            })),
            ...longSources.map(({ source: row, source_version: version }) => ({
              attachments: [],
              body: version.capturedContent,
              id: row.id,
              identity: version.provider,
              kind: "Source" as const,
              occurredAt: version.accessedAt.toISOString(),
              projectId: row.projectId,
              related: related.get(row.id) ?? [],
              status: null,
              title: version.title,
            })),
          ];
          return { readOnly: owned.archivedAt !== null, rows };
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },
  };
}

/** Feedback access with the read-only Feed method attached. */
export function createDatabaseFeedbackWithFeed(database: Database) {
  return {
    ...createFeedback(createDatabaseFeedbackStore(database)),
    ...createFeedbackFeed(createDatabaseFeedbackFeedStore(database)),
  };
}
