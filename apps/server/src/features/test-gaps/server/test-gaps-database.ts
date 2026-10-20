// biome-ignore-all lint/performance/noAwaitInLoops: Relation rows are inserted in their stored order.
import type { PlannedTestRelationInput } from "@cantiara/api/planned-tests";
import type {
  TestGapRelationInput,
  TestGapRelationTarget,
  TestGapRelationTargetType,
  TestGapStore,
  TestGapStoredRecord,
  TestGapStoredRelation,
  TestGapTargetLive,
  TestGapTargetResolver,
} from "@cantiara/api/test-gaps";
import type { Database } from "@cantiara/db";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { testGap, testGapRelation } from "@cantiara/db/schema/test-gap";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import { createResolver } from "../../planned-tests/server/planned-tests-database";
import { createTestGaps } from "./test-gaps";

type Executor = FeedbackExecutor;

const CANDIDATE_LIMIT = 500;

type OwnedFamily = Exclude<TestGapRelationTargetType, "Project Release">;

/**
 * Work, Feature, Document and Risk relations resolve through the same owner
 * resolvers a Planned Test Case relation uses; Project Release has its own
 * owner row, read here. A target the Project does not own is never bound.
 */
function createGapResolver(
  executor: Executor,
  projectId: string,
): TestGapTargetResolver {
  const owned = createResolver(executor, projectId);

  async function releaseLabel(targetId: string) {
    const [row] = await executor
      .select({ name: projectRelease.name })
      .from(projectRelease)
      .where(
        and(
          eq(projectRelease.id, targetId),
          eq(projectRelease.projectId, projectId),
        ),
      );
    return row?.name ?? null;
  }

  return {
    bind: async (relation: TestGapRelationInput) => {
      if (relation.targetType === "Project Release") {
        const label = await releaseLabel(relation.targetId);
        return label === null ? null : { label, sectionLabel: null };
      }
      return await owned.bind(relation as PlannedTestRelationInput);
    },
    candidates: async (
      targetType: TestGapRelationTargetType,
    ): Promise<TestGapRelationTarget[]> => {
      if (targetType === "Project Release") {
        const rows = await executor
          .select({ id: projectRelease.id, name: projectRelease.name })
          .from(projectRelease)
          .where(eq(projectRelease.projectId, projectId))
          .orderBy(asc(projectRelease.name), asc(projectRelease.id))
          .limit(CANDIDATE_LIMIT);
        return rows.map(({ id, name }) => ({
          documentRevision: null,
          label: name,
          sections: [],
          targetId: id,
          targetType,
        }));
      }
      return (await owned.candidates(targetType as OwnedFamily)).map(
        (candidate) => ({ ...candidate, targetType }),
      );
    },
    read: async (
      relation: TestGapStoredRelation,
    ): Promise<TestGapTargetLive> => {
      if (relation.targetType === "Project Release") {
        const label = await releaseLabel(relation.targetId);
        return label === null
          ? { reason: "Permanently deleted", state: "broken" }
          : { label, sectionLabel: null, state: "resolved" };
      }
      return await owned.read({
        ...relation,
        targetType: relation.targetType as OwnedFamily,
      });
    },
  };
}

async function toStoredGaps(
  executor: Executor,
  rows: (typeof testGap.$inferSelect)[],
): Promise<TestGapStoredRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const relationRows = await executor
    .select()
    .from(testGapRelation)
    .where(
      inArray(
        testGapRelation.gapId,
        rows.map(({ id }) => id),
      ),
    )
    .orderBy(asc(testGapRelation.position));
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    projectId: row.projectId,
    rationale: row.rationale,
    relations: relationRows
      .filter((relation) => relation.gapId === row.id)
      .map((relation) => ({
        documentRevision: relation.documentRevision,
        id: relation.id,
        sectionId: relation.sectionId,
        targetId: relation.targetId,
        targetType: relation.targetType as TestGapRelationTargetType,
      })),
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export function createDatabaseTestGapStore(database: Database): TestGapStore {
  return {
    run(accountId, projectId, mode, unitOfWork) {
      return database.transaction(
        async (executor) => {
          const owned =
            mode === "write"
              ? await findOwnedProject(executor, accountId, projectId)
              : await findReadableProject(executor, accountId, projectId);
          if (!owned) {
            return null;
          }
          return await unitOfWork({
            insertGap: async (record) => {
              await executor.insert(testGap).values({
                createdAt: new Date(record.createdAt),
                id: record.id,
                projectId: owned.id,
                rationale: record.rationale,
                title: record.title,
                updatedAt: new Date(record.updatedAt),
              });
              for (const [position, relation] of record.relations.entries()) {
                await executor.insert(testGapRelation).values({
                  documentRevision: relation.documentRevision,
                  gapId: record.id,
                  id: relation.id,
                  position,
                  sectionId: relation.sectionId,
                  targetId: relation.targetId,
                  targetType: relation.targetType,
                });
              }
            },
            listGaps: async () =>
              await toStoredGaps(
                executor,
                await executor
                  .select()
                  .from(testGap)
                  .where(eq(testGap.projectId, owned.id))
                  .orderBy(desc(testGap.createdAt), asc(testGap.id)),
              ),
            readOnly: owned.archivedAt !== null,
            resolver: createGapResolver(executor, owned.id),
          });
        },
        mode === "read"
          ? { accessMode: "read only", isolationLevel: "repeatable read" }
          : undefined,
      );
    },
  };
}

export function createDatabaseTestGaps(database: Database) {
  return createTestGaps(createDatabaseTestGapStore(database));
}
