// biome-ignore-all lint/performance/noAwaitInLoops: Relation rows are inserted in their stored order.
import type { PlannedTestRelationInput } from "@cantiara/api/planned-tests";
import type {
  TestGapClosureOutcome,
  TestGapRelationInput,
  TestGapRelationTarget,
  TestGapRelationTargetType,
  TestGapState,
  TestGapStore,
  TestGapStoredRecord,
  TestGapStoredRelation,
  TestGapTargetLive,
  TestGapTargetResolver,
} from "@cantiara/api/test-gaps";
import type { Database } from "@cantiara/db";
import {
  plannedTestCase,
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
} from "@cantiara/db/schema/planned-test";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  testGap,
  testGapCaseBind,
  testGapHandoffBind,
  testGapMetSessionTest,
  testGapRelation,
} from "@cantiara/db/schema/test-gap";
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

  const decisionRelation = (decisionId: string) => ({
    documentRevision: null,
    id: "decision",
    sectionId: null,
    targetId: decisionId,
    targetType: "Decision" as const,
  });

  return {
    bind: async (relation: TestGapRelationInput) => {
      if (relation.targetType === "Project Release") {
        const label = await releaseLabel(relation.targetId);
        return label === null ? null : { label, sectionLabel: null };
      }
      return await owned.bind(relation as PlannedTestRelationInput);
    },
    bindDecision: async (decisionId: string) => {
      const live = await owned.read(decisionRelation(decisionId));
      return live.state === "resolved" ? live.label : null;
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
    decisionCandidates: async () =>
      (await owned.candidates("Decision")).map(({ label, targetId }) => ({
        label,
        targetId,
      })),
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
    readDecision: async (decisionId: string) =>
      await owned.read(decisionRelation(decisionId)),
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
  const gapIds = rows.map(({ id }) => id);
  const caseBindRows = await executor
    .select({
      caseId: testGapCaseBind.caseId,
      gapId: testGapCaseBind.gapId,
      title: plannedTestCaseVersion.title,
      version: testGapCaseBind.version,
    })
    .from(testGapCaseBind)
    .innerJoin(
      plannedTestCaseVersion,
      and(
        eq(plannedTestCaseVersion.caseId, testGapCaseBind.caseId),
        eq(plannedTestCaseVersion.version, testGapCaseBind.version),
      ),
    )
    .where(inArray(testGapCaseBind.gapId, gapIds))
    .orderBy(asc(testGapCaseBind.createdAt), asc(testGapCaseBind.caseId));
  const handoffBindRows = await executor
    .select({
      gapId: testGapHandoffBind.gapId,
      handoffId: testGapHandoffBind.handoffId,
      handoffState: testHandoff.state,
      title: testHandoff.title,
    })
    .from(testGapHandoffBind)
    .innerJoin(testHandoff, eq(testHandoff.id, testGapHandoffBind.handoffId))
    .where(inArray(testGapHandoffBind.gapId, gapIds))
    .orderBy(
      asc(testGapHandoffBind.createdAt),
      asc(testGapHandoffBind.handoffId),
    );
  const metRows = await executor
    .select({
      gapId: testGapMetSessionTest.gapId,
      sessionTestId: testGapMetSessionTest.sessionTestId,
      title: sessionTest.title,
    })
    .from(testGapMetSessionTest)
    .innerJoin(
      sessionTest,
      eq(sessionTest.id, testGapMetSessionTest.sessionTestId),
    )
    .where(inArray(testGapMetSessionTest.gapId, gapIds))
    .orderBy(
      asc(testGapMetSessionTest.createdAt),
      asc(testGapMetSessionTest.sessionTestId),
    );
  return rows.map((row) => ({
    caseBinds: caseBindRows
      .filter((bind) => bind.gapId === row.id)
      .map(({ caseId, title, version }) => ({ caseId, title, version })),
    closure:
      row.closedAt &&
      (row.state === "Met by result" || row.state === "Not needed")
        ? {
            closedAt: row.closedAt.toISOString(),
            decisionId: row.closureDecisionId,
            outcome: row.state as TestGapClosureOutcome,
            rationale: row.closureRationale,
            sessionTests: metRows
              .filter((met) => met.gapId === row.id)
              .map(({ sessionTestId, title }) => ({ sessionTestId, title })),
          }
        : null,
    createdAt: row.createdAt.toISOString(),
    handoffBinds: handoffBindRows
      .filter((bind) => bind.gapId === row.id)
      .map(({ handoffId, handoffState, title }) => ({
        handoffId,
        handoffState,
        title,
      })),
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
    state: row.state as TestGapState,
    stateChangedAt: row.stateChangedAt.toISOString(),
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
            addCaseBind: async (gapId, ref) => {
              const inserted = await executor
                .insert(testGapCaseBind)
                .values({ caseId: ref.caseId, gapId, version: ref.version })
                .onConflictDoNothing()
                .returning({ gapId: testGapCaseBind.gapId });
              return inserted.length === 1;
            },
            addHandoffBind: async (gapId, handoffId) => {
              const inserted = await executor
                .insert(testGapHandoffBind)
                .values({ gapId, handoffId })
                .onConflictDoNothing()
                .returning({ gapId: testGapHandoffBind.gapId });
              return inserted.length === 1;
            },
            // One statement writes the state, the closure columns and, below,
            // the selected Session Tests; the state moves only while it is
            // still the one the caller saw.
            closeGap: async (gapId, expected, to, closure) => {
              const updated = await executor
                .update(testGap)
                .set({
                  closedAt: new Date(closure.closedAt),
                  closureDecisionId: closure.decisionId,
                  closureRationale: closure.rationale,
                  state: to,
                  stateChangedAt: new Date(closure.closedAt),
                  updatedAt: new Date(closure.closedAt),
                })
                .where(
                  and(
                    eq(testGap.id, gapId),
                    eq(testGap.projectId, owned.id),
                    eq(testGap.state, expected),
                  ),
                )
                .returning({ id: testGap.id });
              if (updated.length !== 1) {
                return false;
              }
              for (const [position, item] of closure.sessionTests.entries()) {
                await executor.insert(testGapMetSessionTest).values({
                  createdAt: new Date(
                    new Date(closure.closedAt).getTime() + position,
                  ),
                  gapId,
                  sessionTestId: item.sessionTestId,
                });
              }
              return true;
            },
            findSessionTests: async (ids) =>
              ids.length === 0
                ? []
                : await executor
                    .select({ id: sessionTest.id, title: sessionTest.title })
                    .from(sessionTest)
                    .where(
                      and(
                        inArray(sessionTest.id, [...ids]),
                        eq(sessionTest.projectId, owned.id),
                      ),
                    ),
            findCaseVersion: async (ref) => {
              const [row] = await executor
                .select({ title: plannedTestCaseVersion.title })
                .from(plannedTestCaseVersion)
                .innerJoin(
                  plannedTestCase,
                  eq(plannedTestCase.id, plannedTestCaseVersion.caseId),
                )
                .where(
                  and(
                    eq(plannedTestCaseVersion.caseId, ref.caseId),
                    eq(plannedTestCaseVersion.version, ref.version),
                    eq(plannedTestCase.projectId, owned.id),
                  ),
                );
              return row ?? null;
            },
            findGap: async (gapId, lock) => {
              const query = executor
                .select()
                .from(testGap)
                .where(
                  and(eq(testGap.id, gapId), eq(testGap.projectId, owned.id)),
                );
              const [row] = await (lock ? query.for("update") : query);
              return row
                ? ((await toStoredGaps(executor, [row]))[0] ?? null)
                : null;
            },
            findHandoff: async (handoffId) => {
              const [row] = await executor
                .select({
                  handoffState: testHandoff.state,
                  title: testHandoff.title,
                })
                .from(testHandoff)
                .where(
                  and(
                    eq(testHandoff.id, handoffId),
                    eq(testHandoff.projectId, owned.id),
                  ),
                );
              return row ?? null;
            },
            insertGap: async (record) => {
              await executor.insert(testGap).values({
                createdAt: new Date(record.createdAt),
                id: record.id,
                projectId: owned.id,
                rationale: record.rationale,
                state: record.state,
                stateChangedAt: new Date(record.stateChangedAt),
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
            removeCaseBind: async (gapId, ref) => {
              const removed = await executor
                .delete(testGapCaseBind)
                .where(
                  and(
                    eq(testGapCaseBind.gapId, gapId),
                    eq(testGapCaseBind.caseId, ref.caseId),
                    eq(testGapCaseBind.version, ref.version),
                  ),
                )
                .returning({ gapId: testGapCaseBind.gapId });
              return removed.length === 1;
            },
            removeHandoffBind: async (gapId, handoffId) => {
              const removed = await executor
                .delete(testGapHandoffBind)
                .where(
                  and(
                    eq(testGapHandoffBind.gapId, gapId),
                    eq(testGapHandoffBind.handoffId, handoffId),
                  ),
                )
                .returning({ gapId: testGapHandoffBind.gapId });
              return removed.length === 1;
            },
            resolver: createGapResolver(executor, owned.id),
            // The state moves only while it is still the one the caller saw.
            setGapState: async (gapId, expected, to, changedAt) => {
              const updated = await executor
                .update(testGap)
                .set({
                  state: to,
                  stateChangedAt: new Date(changedAt),
                  updatedAt: new Date(changedAt),
                })
                .where(
                  and(
                    eq(testGap.id, gapId),
                    eq(testGap.projectId, owned.id),
                    eq(testGap.state, expected),
                  ),
                )
                .returning({ id: testGap.id });
              return updated.length === 1;
            },
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
