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
} from "@cantiara/api/planned-tests";
import type { BrokenReferenceReason } from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { decision } from "@cantiara/db/schema/decision";
import { document as documentTable } from "@cantiara/db/schema/document";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
} from "@cantiara/db/schema/planned-test";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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

  return { bind, candidates, read };
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
            readOnly: owned.archivedAt !== null,
            resolver: createResolver(executor, owned.id),
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
