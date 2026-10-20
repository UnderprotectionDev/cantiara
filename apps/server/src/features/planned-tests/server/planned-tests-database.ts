// biome-ignore-all lint/performance/noAwaitInLoops: Relation rows are inserted in their stored order.
import { documentSectionById, documentSections } from "@cantiara/api/documents";
import type {
  PlannedTestBoundTarget,
  PlannedTestRelationInput,
  PlannedTestRelationTarget,
  PlannedTestRelationTargetType,
  PlannedTestStore,
  PlannedTestStoredCase,
  PlannedTestStoredRelation,
  PlannedTestStoredVersion,
  PlannedTestTargetResolver,
  PlannedTestVersionKind,
  SessionTestBindOrigin,
  SessionTestStoredRecord,
  TestHandoffContextCandidate,
  TestHandoffContextKind,
  TestHandoffContextLive,
  TestHandoffContextRef,
  TestHandoffState,
  TestHandoffStoredRecord,
} from "@cantiara/api/planned-tests";
import type { BrokenReferenceReason } from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document as documentTable } from "@cantiara/db/schema/document";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
  testHandoffAdHocScope,
  testHandoffContextRef,
  testHandoffPackage,
  testHandoffScenario,
  testHandoffSessionTest,
} from "@cantiara/db/schema/planned-test";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { risk } from "@cantiara/db/schema/risk";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import { createPlannedTests } from "./planned-tests";

type Executor = FeedbackExecutor;

const CANDIDATE_LIMIT = 500;

type Live =
  | { label: string; sectionLabel: string | null; state: "resolved" }
  | { reason: BrokenReferenceReason; state: "broken" };

function broken(reason: BrokenReferenceReason): Live {
  return { reason, state: "broken" };
}

function visibility(row: {
  archivedAt?: Date | null;
  status?: string;
  trashedAt?: Date | null;
}): BrokenReferenceReason | null {
  if (row.trashedAt) {
    return "In Trash";
  }
  if (row.archivedAt || row.status === "Archived") {
    return "Archived";
  }
  return null;
}

/** Plain main records: one id lookup scoped to the Project. */
async function titledRow(
  executor: Executor,
  type: Exclude<
    PlannedTestRelationTargetType,
    "Work" | "Feature" | "Document" | "Screen" | "Source"
  >,
  projectId: string,
  targetId: string,
) {
  const table = {
    Decision: decision,
    Milestone: projectMilestone,
    "Project Goal": projectGoal,
    Risk: risk,
  }[type];
  const [row] = await executor
    .select({ id: table.id, title: table.title })
    .from(table)
    .where(and(eq(table.id, targetId), eq(table.projectId, projectId)));
  return row ?? null;
}

async function workRow(
  executor: Executor,
  projectId: string,
  targetId: string,
  type: "Work" | "Feature",
) {
  const [row] = await executor
    .select({
      archivedAt: work.archivedAt,
      id: work.id,
      status: work.status,
      title: work.title,
      trashedAt: work.trashedAt,
      type: work.type,
    })
    .from(work)
    .where(and(eq(work.id, targetId), eq(work.projectId, projectId)));
  if (!row) {
    return null;
  }
  // Feature is Work of type Feature: a Feature relation never lands on other
  // Work and a Work relation never on a Feature.
  return (row.type === "Feature") === (type === "Feature") ? row : null;
}

async function screenRow(
  executor: Executor,
  projectId: string,
  targetId: string,
) {
  const [row] = await executor
    .select({
      archivedAt: screen.archivedAt,
      id: screen.id,
      title: screen.title,
      trashedAt: screen.trashedAt,
    })
    .from(screen)
    .where(and(eq(screen.id, targetId), eq(screen.projectId, projectId)));
  return row ?? null;
}

async function sourceRow(
  executor: Executor,
  projectId: string,
  targetId: string,
) {
  const [row] = await executor
    .select({ id: source.id, title: sourceVersion.title })
    .from(source)
    .innerJoin(
      sourceVersion,
      and(
        eq(sourceVersion.sourceId, source.id),
        eq(sourceVersion.revision, source.revision),
      ),
    )
    .where(and(eq(source.id, targetId), eq(source.projectId, projectId)));
  return row ?? null;
}

async function documentRow(
  executor: Executor,
  projectId: string,
  targetId: string,
) {
  const [row] = await executor
    .select({
      archivedAt: documentTable.archivedAt,
      body: documentTable.body,
      id: documentTable.id,
      revision: documentTable.revision,
      title: documentTable.title,
    })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.id, targetId),
        eq(documentTable.projectId, projectId),
      ),
    );
  return row ?? null;
}

/**
 * Live resolvers of each family's owner record, scoped to the account's
 * Project. Nothing is stored about a target beyond its id (and, for a
 * Document, the exact revision and section), so a title can never stand in for
 * a record and a missing owner record can never be bound.
 */
function createResolver(
  executor: Executor,
  projectId: string,
): PlannedTestTargetResolver {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One switch maps each target family to its owner record and visibility.
  async function read(relation: PlannedTestStoredRelation): Promise<Live> {
    const { targetId, targetType } = relation;
    switch (targetType) {
      case "Work":
      case "Feature": {
        const row = await workRow(executor, projectId, targetId, targetType);
        if (!row) {
          return broken("Permanently deleted");
        }
        const hidden = visibility(row);
        return hidden
          ? broken(hidden)
          : { label: row.title, sectionLabel: null, state: "resolved" };
      }
      case "Screen": {
        const row = await screenRow(executor, projectId, targetId);
        if (!row) {
          return broken("Permanently deleted");
        }
        const hidden = visibility(row);
        return hidden
          ? broken(hidden)
          : { label: row.title, sectionLabel: null, state: "resolved" };
      }
      case "Source": {
        const row = await sourceRow(executor, projectId, targetId);
        return row
          ? { label: row.title, sectionLabel: null, state: "resolved" }
          : broken("Permanently deleted");
      }
      case "Document": {
        const row = await documentRow(executor, projectId, targetId);
        if (!row) {
          return broken("Permanently deleted");
        }
        const hidden = visibility(row);
        if (hidden) {
          return broken(hidden);
        }
        const section = relation.sectionId
          ? documentSectionById(row.body, relation.sectionId)
          : null;
        return {
          label: row.title,
          sectionLabel: section?.heading ?? null,
          state: "resolved",
        };
      }
      default: {
        const row = await titledRow(executor, targetType, projectId, targetId);
        return row
          ? { label: row.title, sectionLabel: null, state: "resolved" }
          : broken("Permanently deleted");
      }
    }
  }

  async function bind(
    relation: PlannedTestRelationInput,
  ): Promise<PlannedTestBoundTarget | null> {
    const live = await read({
      documentRevision:
        "documentRevision" in relation ? relation.documentRevision : null,
      id: "binding",
      sectionId: "sectionId" in relation ? (relation.sectionId ?? null) : null,
      targetId: relation.targetId,
      targetType: relation.targetType,
    });
    if (live.state !== "resolved") {
      return null;
    }
    if (relation.targetType !== "Document") {
      return { label: live.label, sectionLabel: null };
    }
    // A Document relation pins the revision the founder is looking at now.
    const row = await documentRow(executor, projectId, relation.targetId);
    if (!row || row.revision !== relation.documentRevision) {
      return null;
    }
    if (relation.sectionId !== undefined && live.sectionLabel === null) {
      return null;
    }
    return { label: live.label, sectionLabel: live.sectionLabel };
  }

  async function candidates(
    type: PlannedTestRelationTargetType,
  ): Promise<PlannedTestRelationTarget[]> {
    const plain = (rows: { id: string; title: string }[]) =>
      rows.map(
        ({ id, title }): PlannedTestRelationTarget => ({
          documentRevision: null,
          label: title,
          sections: [],
          targetId: id,
          targetType: type,
        }),
      );
    switch (type) {
      case "Work":
      case "Feature": {
        const rows = await executor
          .select({
            archivedAt: work.archivedAt,
            id: work.id,
            status: work.status,
            title: work.title,
            trashedAt: work.trashedAt,
            type: work.type,
          })
          .from(work)
          .where(eq(work.projectId, projectId))
          .orderBy(asc(work.title), asc(work.id))
          .limit(CANDIDATE_LIMIT);
        return plain(
          rows.filter(
            (row) =>
              (row.type === "Feature") === (type === "Feature") &&
              !visibility(row),
          ),
        );
      }
      case "Screen": {
        const rows = await executor
          .select({
            archivedAt: screen.archivedAt,
            id: screen.id,
            title: screen.title,
            trashedAt: screen.trashedAt,
          })
          .from(screen)
          .where(eq(screen.projectId, projectId))
          .orderBy(asc(screen.title), asc(screen.id))
          .limit(CANDIDATE_LIMIT);
        return plain(rows.filter((row) => !visibility(row)));
      }
      case "Source":
        return plain(
          await executor
            .select({ id: source.id, title: sourceVersion.title })
            .from(source)
            .innerJoin(
              sourceVersion,
              and(
                eq(sourceVersion.sourceId, source.id),
                eq(sourceVersion.revision, source.revision),
              ),
            )
            .where(eq(source.projectId, projectId))
            .orderBy(asc(sourceVersion.title), asc(source.id))
            .limit(CANDIDATE_LIMIT),
        );
      case "Document": {
        const rows = await executor
          .select({
            archivedAt: documentTable.archivedAt,
            body: documentTable.body,
            id: documentTable.id,
            revision: documentTable.revision,
            title: documentTable.title,
          })
          .from(documentTable)
          .where(eq(documentTable.projectId, projectId))
          .orderBy(asc(documentTable.title), asc(documentTable.id))
          .limit(CANDIDATE_LIMIT);
        return rows
          .filter((row) => !visibility(row))
          .map(
            (row): PlannedTestRelationTarget => ({
              documentRevision: row.revision,
              label: row.title,
              sections: documentSections(row.body).map((section) => ({
                id: section.id,
                label: section.heading,
              })),
              targetId: row.id,
              targetType: type,
            }),
          );
      }
      default: {
        const table = {
          Decision: decision,
          Milestone: projectMilestone,
          "Project Goal": projectGoal,
          Risk: risk,
        }[type];
        return plain(
          await executor
            .select({ id: table.id, title: table.title })
            .from(table)
            .where(eq(table.projectId, projectId))
            .orderBy(asc(table.title), asc(table.id))
            .limit(CANDIDATE_LIMIT),
        );
      }
    }
  }

  async function wireframeVersions(screenIds: string[]) {
    if (screenIds.length === 0) {
      return new Map<string, number[]>();
    }
    const rows = await executor
      .select({
        screenId: screenWireframeVersion.screenId,
        version: screenWireframeVersion.version,
      })
      .from(screenWireframeVersion)
      .where(inArray(screenWireframeVersion.screenId, screenIds))
      .orderBy(asc(screenWireframeVersion.version));
    const byScreen = new Map<string, number[]>();
    for (const row of rows) {
      byScreen.set(row.screenId, [
        ...(byScreen.get(row.screenId) ?? []),
        row.version,
      ]);
    }
    return byScreen;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One switch maps each context kind to its owner record and visibility.
  async function readContext(
    ref: TestHandoffContextRef,
  ): Promise<TestHandoffContextLive> {
    switch (ref.kind) {
      case "Work":
      case "Feature": {
        const row = await workRow(executor, projectId, ref.targetId, ref.kind);
        if (!row) {
          return broken("Permanently deleted");
        }
        const hidden = visibility(row);
        return hidden
          ? broken(hidden)
          : { label: row.title, sectionLabel: null, state: "resolved" };
      }
      case "Document": {
        const row = await documentRow(executor, projectId, ref.targetId);
        if (!row) {
          return broken("Permanently deleted");
        }
        const hidden = visibility(row);
        if (hidden) {
          return broken(hidden);
        }
        // A pinned section reads against the owner's current state: a section
        // that no longer exists keeps the record available but reads as gone,
        // exactly like a case relation's missing section.
        const section = ref.sectionId
          ? documentSectionById(row.body, ref.sectionId)
          : null;
        return {
          label: row.title,
          sectionLabel: section?.heading ?? null,
          state: "resolved",
        };
      }
      default: {
        const row = await screenRow(executor, projectId, ref.targetId);
        if (!row) {
          return broken("Permanently deleted");
        }
        const hidden = visibility(row);
        if (hidden) {
          return broken(hidden);
        }
        const versions = await wireframeVersions([row.id]);
        return versions.get(row.id)?.includes(ref.wireframeVersion)
          ? { label: row.title, sectionLabel: null, state: "resolved" }
          : broken("Permanently deleted");
      }
    }
  }

  async function bindContext(ref: TestHandoffContextRef) {
    const live = await readContext(ref);
    if (live.state !== "resolved") {
      return null;
    }
    if (ref.kind !== "Document") {
      return live.label;
    }
    // A Document reference pins the revision the founder is looking at now.
    const row = await documentRow(executor, projectId, ref.targetId);
    if (!row || row.revision !== ref.documentRevision) {
      return null;
    }
    if (ref.sectionId !== null && live.sectionLabel === null) {
      return null;
    }
    return live.label;
  }

  async function contextCandidates(
    kind: TestHandoffContextKind,
  ): Promise<TestHandoffContextCandidate[]> {
    const plain = (
      rows: { id: string; title: string }[],
    ): TestHandoffContextCandidate[] =>
      rows.map(({ id, title }) => ({
        documentRevision: null,
        kind,
        label: title,
        sections: [],
        targetId: id,
        wireframeVersions: [],
      }));
    switch (kind) {
      case "Work":
      case "Feature": {
        const rows = await executor
          .select({
            archivedAt: work.archivedAt,
            id: work.id,
            status: work.status,
            title: work.title,
            trashedAt: work.trashedAt,
            type: work.type,
          })
          .from(work)
          .where(eq(work.projectId, projectId))
          .orderBy(asc(work.title), asc(work.id))
          .limit(CANDIDATE_LIMIT);
        return plain(
          rows.filter(
            (row) =>
              (row.type === "Feature") === (kind === "Feature") &&
              !visibility(row),
          ),
        );
      }
      case "Document": {
        const rows = await executor
          .select({
            archivedAt: documentTable.archivedAt,
            body: documentTable.body,
            id: documentTable.id,
            revision: documentTable.revision,
            title: documentTable.title,
          })
          .from(documentTable)
          .where(eq(documentTable.projectId, projectId))
          .orderBy(asc(documentTable.title), asc(documentTable.id))
          .limit(CANDIDATE_LIMIT);
        return rows
          .filter((row) => !visibility(row))
          .map(
            (row): TestHandoffContextCandidate => ({
              documentRevision: row.revision,
              kind,
              label: row.title,
              sections: documentSections(row.body).map((section) => ({
                id: section.id,
                label: section.heading,
              })),
              targetId: row.id,
              wireframeVersions: [],
            }),
          );
      }
      default: {
        const rows = (
          await executor
            .select({
              archivedAt: screen.archivedAt,
              id: screen.id,
              title: screen.title,
              trashedAt: screen.trashedAt,
            })
            .from(screen)
            .where(eq(screen.projectId, projectId))
            .orderBy(asc(screen.title), asc(screen.id))
            .limit(CANDIDATE_LIMIT)
        ).filter((row) => !visibility(row));
        const versions = await wireframeVersions(rows.map(({ id }) => id));
        return plain(rows)
          .map((candidate) => ({
            ...candidate,
            wireframeVersions: versions.get(candidate.targetId) ?? [],
          }))
          .filter((candidate) => candidate.wireframeVersions.length > 0);
      }
    }
  }

  return {
    bind,
    bindContext,
    candidates,
    contextCandidates,
    read,
    readContext,
  };
}

function toStoredVersion(
  row: typeof plannedTestCaseVersion.$inferSelect,
  relations: (typeof plannedTestCaseRelation.$inferSelect)[],
): PlannedTestStoredVersion {
  return {
    caseId: row.caseId,
    changeKind: row.changeKind as PlannedTestVersionKind,
    createdAt: row.createdAt.toISOString(),
    expectedBehavior: row.expectedBehavior,
    id: row.id,
    notes: row.notes,
    preconditions: row.preconditions,
    purpose: row.purpose,
    relations: relations
      .filter(({ versionId }) => versionId === row.id)
      .sort((left, right) => left.position - right.position)
      .map((relation) => ({
        documentRevision: relation.documentRevision,
        id: relation.id,
        sectionId: relation.sectionId,
        targetId: relation.targetId,
        targetType: relation.targetType as PlannedTestRelationTargetType,
      })),
    scope: row.scope,
    title: row.title,
    version: row.version,
  };
}

async function toStoredCases(
  executor: Executor,
  rows: (typeof plannedTestCase.$inferSelect)[],
): Promise<PlannedTestStoredCase[]> {
  if (rows.length === 0) {
    return [];
  }
  const versions = await executor
    .select()
    .from(plannedTestCaseVersion)
    .where(
      inArray(
        plannedTestCaseVersion.caseId,
        rows.map(({ id }) => id),
      ),
    )
    .orderBy(asc(plannedTestCaseVersion.version));
  const relations = versions.length
    ? await executor
        .select()
        .from(plannedTestCaseRelation)
        .where(
          inArray(
            plannedTestCaseRelation.versionId,
            versions.map(({ id }) => id),
          ),
        )
    : [];
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    currentVersion: row.currentVersion,
    id: row.id,
    projectId: row.projectId,
    updatedAt: row.updatedAt.toISOString(),
    versions: versions
      .filter(({ caseId }) => caseId === row.id)
      .map((version) => toStoredVersion(version, relations)),
  }));
}

async function insertVersion(
  executor: Executor,
  version: PlannedTestStoredVersion,
) {
  await executor.insert(plannedTestCaseVersion).values({
    caseId: version.caseId,
    changeKind: version.changeKind,
    createdAt: new Date(version.createdAt),
    expectedBehavior: version.expectedBehavior,
    id: version.id,
    notes: version.notes,
    preconditions: version.preconditions,
    purpose: version.purpose,
    scope: version.scope,
    title: version.title,
    version: version.version,
  });
  if (version.relations.length > 0) {
    await executor.insert(plannedTestCaseRelation).values(
      version.relations.map((relation, position) => ({
        documentRevision: relation.documentRevision,
        id: relation.id,
        position,
        sectionId: relation.sectionId,
        targetId: relation.targetId,
        targetType: relation.targetType,
        versionId: version.id,
      })),
    );
  }
}

function toStoredSessionTest(
  row: typeof sessionTest.$inferSelect,
): SessionTestStoredRecord {
  return {
    bindOrigin: row.bindOrigin as SessionTestBindOrigin | null,
    createdAt: row.createdAt.toISOString(),
    expectedBehavior: row.expectedBehavior,
    id: row.id,
    linkedAt: row.linkedAt?.toISOString() ?? null,
    projectId: row.projectId,
    purpose: row.purpose,
    scenarioId: row.scenarioId,
    scenarioVersion: row.scenarioVersion,
    title: row.title,
  };
}

const HANDOFF_CONTENT_COLUMNS = (
  content: Pick<
    TestHandoffStoredRecord,
    | "buildContext"
    | "dueDate"
    | "environmentPreconditions"
    | "purpose"
    | "targetExecutor"
    | "title"
  >,
) => ({
  buildBranch: content.buildContext.branch,
  buildCommit: content.buildContext.commit,
  buildName: content.buildContext.build,
  buildRepository: content.buildContext.repository,
  buildTargetEnvironment: content.buildContext.targetEnvironment,
  dueDate: content.dueDate,
  environmentPreconditions: content.environmentPreconditions,
  purpose: content.purpose,
  targetExecutor: content.targetExecutor,
  title: content.title,
});

async function toStoredHandoffs(
  executor: Executor,
  rows: (typeof testHandoff.$inferSelect)[],
): Promise<TestHandoffStoredRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map(({ id }) => id);
  const scenarios = await executor
    .select()
    .from(testHandoffScenario)
    .where(inArray(testHandoffScenario.handoffId, ids))
    .orderBy(asc(testHandoffScenario.position));
  const adHoc = await executor
    .select()
    .from(testHandoffAdHocScope)
    .where(inArray(testHandoffAdHocScope.handoffId, ids))
    .orderBy(asc(testHandoffAdHocScope.position));
  const contextRefs = await executor
    .select()
    .from(testHandoffContextRef)
    .where(inArray(testHandoffContextRef.handoffId, ids))
    .orderBy(asc(testHandoffContextRef.position));
  const links = await executor
    .select()
    .from(testHandoffSessionTest)
    .where(inArray(testHandoffSessionTest.handoffId, ids))
    .orderBy(
      asc(testHandoffSessionTest.linkedAt),
      asc(testHandoffSessionTest.sessionTestId),
    );
  return rows.map((row) => ({
    adHocScope: adHoc
      .filter(({ handoffId }) => handoffId === row.id)
      .map(({ expectedBehavior, intent }) => ({ expectedBehavior, intent })),
    buildContext: {
      branch: row.buildBranch,
      build: row.buildName,
      commit: row.buildCommit,
      repository: row.buildRepository,
      targetEnvironment: row.buildTargetEnvironment,
    },
    contextRefs: contextRefs
      .filter(({ handoffId }) => handoffId === row.id)
      .map((ref): TestHandoffContextRef => {
        if (ref.kind === "Document") {
          return {
            documentRevision: ref.documentRevision ?? 0,
            kind: "Document",
            sectionId: ref.sectionId,
            targetId: ref.targetId,
          };
        }
        if (ref.kind === "Wireframe") {
          return {
            kind: "Wireframe",
            targetId: ref.targetId,
            wireframeVersion: ref.wireframeVersion ?? 1,
          };
        }
        return {
          kind: ref.kind === "Feature" ? "Feature" : "Work",
          targetId: ref.targetId,
        };
      }),
    createdAt: row.createdAt.toISOString(),
    dueDate: row.dueDate,
    environmentPreconditions: row.environmentPreconditions,
    id: row.id,
    packageVersion: row.packageVersion,
    projectId: row.projectId,
    purpose: row.purpose,
    scenarios: scenarios
      .filter(({ handoffId }) => handoffId === row.id)
      .map(({ caseId, version }) => ({ caseId, version })),
    sessionTests: links
      .filter(({ handoffId }) => handoffId === row.id)
      .map(({ linkedAt, sessionTestId }) => ({
        linkedAt: linkedAt.toISOString(),
        sessionTestId,
      })),
    state: row.state as TestHandoffState,
    stateChangedAt: row.stateChangedAt.toISOString(),
    targetExecutor: row.targetExecutor,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function insertHandoffScenarios(
  executor: Executor,
  handoffId: string,
  scenarios: TestHandoffStoredRecord["scenarios"],
) {
  if (scenarios.length > 0) {
    await executor.insert(testHandoffScenario).values(
      scenarios.map(({ caseId, version }, position) => ({
        caseId,
        handoffId,
        position,
        version,
      })),
    );
  }
}

async function insertHandoffContent(
  executor: Executor,
  handoffId: string,
  content: Pick<TestHandoffStoredRecord, "adHocScope" | "contextRefs">,
) {
  if (content.adHocScope.length > 0) {
    await executor.insert(testHandoffAdHocScope).values(
      content.adHocScope.map(({ expectedBehavior, intent }, position) => ({
        expectedBehavior,
        handoffId,
        intent,
        position,
      })),
    );
  }
  if (content.contextRefs.length > 0) {
    await executor.insert(testHandoffContextRef).values(
      content.contextRefs.map((ref, position) => ({
        documentRevision: ref.kind === "Document" ? ref.documentRevision : null,
        handoffId,
        kind: ref.kind,
        position,
        sectionId: ref.kind === "Document" ? ref.sectionId : null,
        targetId: ref.targetId,
        wireframeVersion:
          ref.kind === "Wireframe" ? ref.wireframeVersion : null,
      })),
    );
  }
}

export function createDatabasePlannedTestStore(
  database: Database,
): PlannedTestStore {
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
            // The counter moves only from the value the caller read, in the
            // same transaction that stores the package, so two producers can
            // never both claim one version.
            bumpPackageVersion: async (handoffId, expected) => {
              const updated = await executor
                .update(testHandoff)
                .set({ packageVersion: expected + 1 })
                .where(
                  and(
                    eq(testHandoff.id, handoffId),
                    eq(testHandoff.projectId, owned.id),
                    eq(testHandoff.packageVersion, expected),
                  ),
                )
                .returning({ id: testHandoff.id });
              return updated.length === 1;
            },
            insertPackage: async (record) => {
              await executor.insert(testHandoffPackage).values({
                createdAt: new Date(record.createdAt),
                handoffId: record.handoffId,
                json: record.json,
                markdown: record.markdown,
                packageVersion: record.packageVersion,
              });
            },
            listPackages: async (handoffId) =>
              (
                await executor
                  .select()
                  .from(testHandoffPackage)
                  .where(eq(testHandoffPackage.handoffId, handoffId))
                  .orderBy(desc(testHandoffPackage.packageVersion))
              ).map((row) => ({
                createdAt: row.createdAt.toISOString(),
                handoffId: row.handoffId,
                json: row.json,
                markdown: row.markdown,
                packageVersion: row.packageVersion,
              })),
            project: { id: owned.id, name: owned.project.name },
            appendVersion: async (caseId, version, updatedAt) => {
              await insertVersion(executor, version);
              await executor
                .update(plannedTestCase)
                .set({
                  currentVersion: version.version,
                  updatedAt: new Date(updatedAt),
                })
                .where(eq(plannedTestCase.id, caseId));
            },
            findCase: async (caseId, lock) => {
              const query = executor
                .select()
                .from(plannedTestCase)
                .where(
                  and(
                    eq(plannedTestCase.id, caseId),
                    eq(plannedTestCase.projectId, owned.id),
                  ),
                );
              const [row] = lock ? await query.for("update") : await query;
              if (!row) {
                return null;
              }
              const [stored] = await toStoredCases(executor, [row]);
              return stored ?? null;
            },
            findHandoff: async (handoffId, lock) => {
              const query = executor
                .select()
                .from(testHandoff)
                .where(
                  and(
                    eq(testHandoff.id, handoffId),
                    eq(testHandoff.projectId, owned.id),
                  ),
                );
              const [row] = lock ? await query.for("update") : await query;
              if (!row) {
                return null;
              }
              const [stored] = await toStoredHandoffs(executor, [row]);
              return stored ?? null;
            },
            findSessionTest: async (sessionTestId, lock) => {
              const query = executor
                .select()
                .from(sessionTest)
                .where(
                  and(
                    eq(sessionTest.id, sessionTestId),
                    eq(sessionTest.projectId, owned.id),
                  ),
                );
              const [row] = lock ? await query.for("update") : await query;
              return row ? toStoredSessionTest(row) : null;
            },
            insertCase: async (record) => {
              await executor.insert(plannedTestCase).values({
                createdAt: new Date(record.createdAt),
                currentVersion: record.currentVersion,
                id: record.id,
                projectId: owned.id,
                updatedAt: new Date(record.updatedAt),
              });
              for (const version of record.versions) {
                await insertVersion(executor, version);
              }
            },
            insertHandoff: async (record) => {
              await executor.insert(testHandoff).values({
                ...HANDOFF_CONTENT_COLUMNS(record),
                createdAt: new Date(record.createdAt),
                id: record.id,
                packageVersion: record.packageVersion,
                projectId: owned.id,
                state: record.state,
                stateChangedAt: new Date(record.stateChangedAt),
                updatedAt: new Date(record.updatedAt),
              });
              await insertHandoffScenarios(
                executor,
                record.id,
                record.scenarios,
              );
              await insertHandoffContent(executor, record.id, record);
            },
            insertSessionTest: async (record) => {
              await executor.insert(sessionTest).values({
                bindOrigin: record.bindOrigin,
                createdAt: new Date(record.createdAt),
                expectedBehavior: record.expectedBehavior,
                id: record.id,
                linkedAt: record.linkedAt ? new Date(record.linkedAt) : null,
                projectId: owned.id,
                purpose: record.purpose,
                scenarioId: record.scenarioId,
                scenarioVersion: record.scenarioVersion,
                title: record.title,
              });
            },
            // The session test id is the primary key, so a second Handoff (or a
            // repeat) conflicts and nothing is written.
            linkHandoffSessionTest: async (
              handoffId,
              sessionTestId,
              linkedAt,
            ) => {
              const inserted = await executor
                .insert(testHandoffSessionTest)
                .values({
                  handoffId,
                  linkedAt: new Date(linkedAt),
                  sessionTestId,
                })
                .onConflictDoNothing()
                .returning({ id: testHandoffSessionTest.sessionTestId });
              return inserted.length === 1;
            },
            // Only the bind columns are written, and only while there is none,
            // so the recorded content and an existing bind can never change.
            linkSessionTest: async (sessionTestId, ref, linkedAt) => {
              const updated = await executor
                .update(sessionTest)
                .set({
                  bindOrigin: "Linked later",
                  linkedAt: new Date(linkedAt),
                  scenarioId: ref.caseId,
                  scenarioVersion: ref.version,
                })
                .where(
                  and(
                    eq(sessionTest.id, sessionTestId),
                    eq(sessionTest.projectId, owned.id),
                    isNull(sessionTest.scenarioId),
                  ),
                )
                .returning({ id: sessionTest.id });
              return updated.length === 1;
            },
            listCases: async () =>
              await toStoredCases(
                executor,
                await executor
                  .select()
                  .from(plannedTestCase)
                  .where(eq(plannedTestCase.projectId, owned.id))
                  .orderBy(
                    desc(plannedTestCase.createdAt),
                    asc(plannedTestCase.id),
                  ),
              ),
            listHandoffs: async () =>
              await toStoredHandoffs(
                executor,
                await executor
                  .select()
                  .from(testHandoff)
                  .where(eq(testHandoff.projectId, owned.id))
                  .orderBy(desc(testHandoff.createdAt), asc(testHandoff.id)),
              ),
            listSessionTests: async () =>
              (
                await executor
                  .select()
                  .from(sessionTest)
                  // Tests reported inside a Test Session (spec 54) belong to that session.
                  .where(
                    and(
                      eq(sessionTest.projectId, owned.id),
                      isNull(sessionTest.sessionId),
                    ),
                  )
                  .orderBy(desc(sessionTest.createdAt), asc(sessionTest.id))
              ).map(toStoredSessionTest),
            readOnly: owned.archivedAt !== null,
            replaceHandoffContent: async (handoffId, content, updatedAt) => {
              await executor
                .update(testHandoff)
                .set({
                  ...HANDOFF_CONTENT_COLUMNS(content),
                  updatedAt: new Date(updatedAt),
                })
                .where(eq(testHandoff.id, handoffId));
              await executor
                .delete(testHandoffScenario)
                .where(eq(testHandoffScenario.handoffId, handoffId));
              await insertHandoffScenarios(
                executor,
                handoffId,
                content.scenarios,
              );
              await executor
                .delete(testHandoffAdHocScope)
                .where(eq(testHandoffAdHocScope.handoffId, handoffId));
              await executor
                .delete(testHandoffContextRef)
                .where(eq(testHandoffContextRef.handoffId, handoffId));
              await insertHandoffContent(executor, handoffId, content);
            },
            resolver: createResolver(executor, owned.id),
            // The state moves only while it is still the one the caller saw.
            setHandoffState: async (handoffId, expected, to, changedAt) => {
              const updated = await executor
                .update(testHandoff)
                .set({
                  state: to,
                  stateChangedAt: new Date(changedAt),
                  updatedAt: new Date(changedAt),
                })
                .where(
                  and(
                    eq(testHandoff.id, handoffId),
                    eq(testHandoff.projectId, owned.id),
                    eq(testHandoff.state, expected),
                  ),
                )
                .returning({ id: testHandoff.id });
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

export function createDatabasePlannedTests(database: Database) {
  return createPlannedTests(createDatabasePlannedTestStore(database));
}
