// biome-ignore-all lint/performance/noAwaitInLoops: Cited ids are inserted in the founder's order.
import type {
  TestAssessmentContext,
  TestAssessmentSourceKind,
  TestAssessmentStore,
  TestAssessmentStoredRecord,
} from "@cantiara/api/test-assessments";
import type { Database } from "@cantiara/db";
import { testHandoff } from "@cantiara/db/schema/planned-test";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  testAssessment,
  testAssessmentSource,
} from "@cantiara/db/schema/test-assessment";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import { createTestAssessments } from "./test-assessments";

type Executor = FeedbackExecutor;

const CANDIDATE_LIMIT = 500;

/** Trashed and archived Works are unavailable, like the sibling target resolvers. */
interface WorkAvailability {
  archivedAt: Date | null;
  status: string;
  trashedAt: Date | null;
}

function workUnavailable(row: WorkAvailability) {
  return Boolean(row.trashedAt || row.archivedAt || row.status === "Archived");
}

async function contextLabel(
  executor: Executor,
  projectId: string,
  context: TestAssessmentContext,
): Promise<string | null> {
  if (context.kind === "Handoff") {
    const [row] = await executor
      .select({ title: testHandoff.title })
      .from(testHandoff)
      .where(
        and(
          eq(testHandoff.id, context.targetId),
          eq(testHandoff.projectId, projectId),
        ),
      );
    return row?.title ?? null;
  }
  if (context.kind === "Project Release") {
    const [row] = await executor
      .select({ name: projectRelease.name })
      .from(projectRelease)
      .where(
        and(
          eq(projectRelease.id, context.targetId),
          eq(projectRelease.projectId, projectId),
        ),
      );
    return row?.name ?? null;
  }
  const [row] = await executor
    .select({
      title: work.title,
      type: work.type,
      trashedAt: work.trashedAt,
      archivedAt: work.archivedAt,
      status: work.status,
    })
    .from(work)
    .where(and(eq(work.id, context.targetId), eq(work.projectId, projectId)));
  // Trashed or archived Works are unavailable; the stored snapshot bytes stay
  // as saved, only the live label resolves to `null`, like a removed record.
  return row?.type === "Feature" && !workUnavailable(row) ? row.title : null;
}

async function toStored(
  executor: Executor,
  rows: (typeof testAssessment.$inferSelect)[],
): Promise<TestAssessmentStoredRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const sources = await executor
    .select()
    .from(testAssessmentSource)
    .where(
      inArray(
        testAssessmentSource.assessmentId,
        rows.map(({ id }) => id),
      ),
    )
    .orderBy(asc(testAssessmentSource.position));
  const idsOf = (assessmentId: string, kind: TestAssessmentSourceKind) =>
    sources
      .filter(
        (source) =>
          source.assessmentId === assessmentId && source.sourceKind === kind,
      )
      .map(({ sourceId }) => sourceId);
  return rows.map((row) => ({
    assessedAt: row.assessedAt.toISOString(),
    assessorAccountId: row.assessorAccountId,
    context: {
      kind: row.contextKind as TestAssessmentContext["kind"],
      targetId: row.contextId,
    },
    decision: row.decision as TestAssessmentStoredRecord["decision"],
    followUpWorkIds: idsOf(row.id, "Follow-up Work"),
    gapIds: idsOf(row.id, "Test Gap"),
    id: row.id,
    knownLimits: row.knownLimits,
    projectId: row.projectId,
    sessionIds: idsOf(row.id, "Test Session"),
  }));
}

export function createDatabaseTestAssessmentStore(
  database: Database,
): TestAssessmentStore {
  return {
    run(accountId, projectId, mode, unitOfWork) {
      return database.transaction(async (executor) => {
        const owned =
          mode === "write"
            ? await findOwnedProject(executor, accountId, projectId)
            : await findReadableProject(executor, accountId, projectId);
        if (!owned) {
          return null;
        }
        return await unitOfWork({
          contextCandidates: async (kind) => {
            if (kind === "Handoff") {
              return (
                await executor
                  .select({ id: testHandoff.id, label: testHandoff.title })
                  .from(testHandoff)
                  .where(eq(testHandoff.projectId, owned.id))
                  .orderBy(desc(testHandoff.updatedAt))
                  .limit(CANDIDATE_LIMIT)
              ).map((row) => ({ ...row, kind }));
            }
            if (kind === "Project Release") {
              return (
                await executor
                  .select({ id: projectRelease.id, label: projectRelease.name })
                  .from(projectRelease)
                  .where(eq(projectRelease.projectId, owned.id))
                  .orderBy(desc(projectRelease.updatedAt))
                  .limit(CANDIDATE_LIMIT)
              ).map((row) => ({ ...row, kind }));
            }
            return (
              await executor
                .select({
                  archivedAt: work.archivedAt,
                  id: work.id,
                  label: work.title,
                  status: work.status,
                  trashedAt: work.trashedAt,
                })
                .from(work)
                .where(
                  and(eq(work.projectId, owned.id), eq(work.type, "Feature")),
                )
                .orderBy(desc(work.updatedAt))
                .limit(CANDIDATE_LIMIT)
            )
              .filter((row) => !workUnavailable(row))
              .map((row) => ({ id: row.id, kind, label: row.label }));
          },
          // Test Session, Test Gap and bound-context owners (specs 54, 55, 57)
          // report their events here when they exist; none do yet.
          contextEvents: () => Promise.resolve([]),
          contextLabel: (context) => contextLabel(executor, owned.id, context),
          insert: async (record) => {
            await executor.insert(testAssessment).values({
              assessedAt: new Date(record.assessedAt),
              assessorAccountId: record.assessorAccountId,
              contextId: record.context.targetId,
              contextKind: record.context.kind,
              decision: record.decision,
              id: record.id,
              knownLimits: record.knownLimits,
              projectId: record.projectId,
            });
            const cited = [
              ...record.sessionIds.map((id) => ["Test Session", id] as const),
              ...record.gapIds.map((id) => ["Test Gap", id] as const),
              ...record.followUpWorkIds.map(
                (id) => ["Follow-up Work", id] as const,
              ),
            ];
            for (const [position, [sourceKind, sourceId]] of cited.entries()) {
              await executor.insert(testAssessmentSource).values({
                assessmentId: record.id,
                position,
                sourceId,
                sourceKind,
              });
            }
          },
          list: async () =>
            await toStored(
              executor,
              await executor
                .select()
                .from(testAssessment)
                .where(eq(testAssessment.projectId, owned.id))
                .orderBy(desc(testAssessment.assessedAt)),
            ),
          readOnly: owned.archivedAt !== null,
          // Only follow-up Work has an owner record today; session and Gap ids
          // stay opaque until their owners exist. Trashed and archived Works
          // are refused like any other unavailable cited record.
          unknownSources: async (kind, ids) => {
            if (kind !== "Follow-up Work" || ids.length === 0) {
              return [];
            }
            const found = await executor
              .select({
                archivedAt: work.archivedAt,
                id: work.id,
                status: work.status,
                trashedAt: work.trashedAt,
              })
              .from(work)
              .where(and(eq(work.projectId, owned.id), inArray(work.id, ids)));
            const known = new Set(
              found.filter((row) => !workUnavailable(row)).map(({ id }) => id),
            );
            return ids.filter((id) => !known.has(id));
          },
        });
      });
    },
  };
}

export function createDatabaseTestAssessments(database: Database) {
  return createTestAssessments(createDatabaseTestAssessmentStore(database));
}
