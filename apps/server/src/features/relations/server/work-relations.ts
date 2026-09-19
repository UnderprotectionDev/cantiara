import {
  SCOPE_TREE_RELATION_KIND_OPTIONS,
  type ScopeTreeRelationKind,
  type ScopeTreeWork,
  scopeTreeRelationKindSchema,
  type WorkRecreateRelation,
  type WorkRecreateRelationKind,
  workRecreateRelationKindSchema,
  workStatusSchema,
  workTypeSchema,
} from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project, work, workRelation } from "@cantiara/db/schema/index";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import { describeWorkRecreateRelation } from "./work-recreate-relations";

export interface RecreateRelationSelectionInput {
  selectedRelationIds: string[];
  sourceWorkId: string;
  sourceWorkRevision: number;
}

export interface WorkRelationSource {
  id: string;
  key: string;
  projectId: string;
  revision: number;
}

export interface WorkRelationCopy {
  kind: WorkRecreateRelationKind;
  targetLabel: string;
  targetProjectId: string;
  targetRecordId: string;
}

export interface RecreateRelationSelection {
  selectedRelations: WorkRelationCopy[];
  sourceWork: WorkRelationSource;
}

export interface ScopeTreeRelation {
  id: string;
  kind: ScopeTreeRelationKind;
  sourceProjectId: string;
  sourceWork: ScopeTreeWork;
  targetLabel: string;
  targetRecordId: string;
}

export interface WorkRelations {
  listRecreateRelations: (
    accountId: string,
    workId: string,
  ) => Promise<WorkRecreateRelation[]>;
  listScopeTreeRelations: (
    accountId: string,
    projectId: string,
  ) => Promise<readonly ScopeTreeRelation[]>;
}

export interface WorkRelationsMutationAdapter extends WorkRelations {
  persistRecreatedRelations: (
    executor: MutationDatabaseExecutor,
    committedAt: Date,
    createdWork: Pick<WorkRelationSource, "id" | "key" | "projectId">,
    selection: RecreateRelationSelection,
  ) => Promise<void>;
  selectRecreateRelations: (
    executor: MutationDatabaseExecutor,
    accountId: string,
    workspaceId: string,
    input: RecreateRelationSelectionInput,
  ) => Promise<RecreateRelationSelection | null>;
}

async function findOwnedWorkspaceId(
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

async function findOwnedWork(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workId: string,
  lock: boolean,
) {
  const workspaceId = await findOwnedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select({ record: work })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [result] = records;
  return result?.record ?? null;
}

function parseRelationKind(value: string) {
  return workRecreateRelationKindSchema.parse(value);
}

function relationPreview(
  relation: typeof workRelation.$inferSelect,
  targetProjectName: string,
  targetRecordId = relation.targetRecordId,
  targetLabel = relation.targetLabel,
): WorkRecreateRelation {
  const kind = parseRelationKind(relation.kind);
  return {
    id: relation.id,
    kind,
    ...describeWorkRecreateRelation(kind),
    targetLabel,
    targetProjectName,
    targetRecordId,
  };
}

export function createDatabaseWorkRelations(
  database: Database,
): WorkRelationsMutationAdapter {
  return {
    async listRecreateRelations(accountId, workId) {
      const sourceWork = await findOwnedWork(
        database,
        accountId,
        workId,
        false,
      );
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!(sourceWork && workspaceId)) {
        return [];
      }

      const [outgoing, incomingOrigin] = await Promise.all([
        database
          .select({
            relation: workRelation,
            targetProjectName: project.name,
          })
          .from(workRelation)
          .innerJoin(project, eq(workRelation.targetProjectId, project.id))
          .where(
            and(
              eq(workRelation.sourceWorkId, sourceWork.id),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .orderBy(asc(workRelation.createdAt), asc(workRelation.id)),
        database
          .select({
            relation: workRelation,
            sourceWorkKey: work.key,
            sourceProjectName: project.name,
          })
          .from(workRelation)
          .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
          .innerJoin(project, eq(work.projectId, project.id))
          .where(
            and(
              eq(workRelation.kind, "Origin"),
              eq(workRelation.targetProjectId, sourceWork.projectId),
              eq(workRelation.targetRecordId, sourceWork.id),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .orderBy(asc(workRelation.createdAt), asc(workRelation.id)),
      ]);

      return [
        ...outgoing.map(({ relation, targetProjectName }) =>
          relationPreview(relation, targetProjectName),
        ),
        ...incomingOrigin.map(
          ({ relation, sourceProjectName, sourceWorkKey }) =>
            relationPreview(
              relation,
              sourceProjectName,
              relation.sourceWorkId,
              sourceWorkKey,
            ),
        ),
      ].sort((left, right) => left.id.localeCompare(right.id));
    },

    async listScopeTreeRelations(accountId, projectId) {
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }

      const records = await database
        .select({
          id: workRelation.id,
          kind: workRelation.kind,
          sourceProjectId: project.id,
          sourceWorkId: work.id,
          sourceWorkKey: work.key,
          sourceWorkStatus: work.status,
          sourceWorkTitle: work.title,
          sourceWorkType: work.type,
          targetLabel: workRelation.targetLabel,
          targetRecordId: workRelation.targetRecordId,
        })
        .from(workRelation)
        .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            eq(workRelation.targetProjectId, projectId),
            inArray(workRelation.kind, SCOPE_TREE_RELATION_KIND_OPTIONS),
          ),
        )
        .orderBy(asc(workRelation.createdAt), asc(workRelation.id));

      return records.map((record) => ({
        id: record.id,
        kind: scopeTreeRelationKindSchema.parse(record.kind),
        sourceProjectId: record.sourceProjectId,
        sourceWork: {
          id: record.sourceWorkId,
          key: record.sourceWorkKey,
          status: workStatusSchema.parse(record.sourceWorkStatus),
          title: record.sourceWorkTitle,
          type: workTypeSchema.parse(record.sourceWorkType),
        },
        targetLabel: record.targetLabel,
        targetRecordId: record.targetRecordId,
      }));
    },

    async selectRecreateRelations(executor, accountId, workspaceId, input) {
      const sourceWork = await findOwnedWork(
        executor,
        accountId,
        input.sourceWorkId,
        true,
      );
      if (!sourceWork || sourceWork.revision !== input.sourceWorkRevision) {
        return null;
      }

      const selectedRelationIds = [...new Set(input.selectedRelationIds)];
      const selectedRelations =
        selectedRelationIds.length === 0
          ? []
          : await executor
              .select({ relation: workRelation })
              .from(workRelation)
              .innerJoin(project, eq(workRelation.targetProjectId, project.id))
              .where(
                and(
                  eq(workRelation.sourceWorkId, sourceWork.id),
                  inArray(workRelation.id, selectedRelationIds),
                  eq(project.workspaceId, workspaceId),
                ),
              )
              .then((records) =>
                records
                  .map(({ relation }) => ({
                    kind: parseRelationKind(relation.kind),
                    targetLabel: relation.targetLabel,
                    targetProjectId: relation.targetProjectId,
                    targetRecordId: relation.targetRecordId,
                  }))
                  .filter(
                    (relation) =>
                      describeWorkRecreateRelation(relation.kind).portable,
                  ),
              );
      if (selectedRelations.length !== selectedRelationIds.length) {
        return null;
      }

      return {
        selectedRelations,
        sourceWork: {
          id: sourceWork.id,
          key: sourceWork.key,
          projectId: sourceWork.projectId,
          revision: sourceWork.revision,
        },
      };
    },

    async persistRecreatedRelations(
      executor,
      committedAt,
      createdWork,
      selection,
    ) {
      await executor.insert(workRelation).values([
        ...selection.selectedRelations.map((relation) => ({
          createdAt: committedAt,
          id: crypto.randomUUID(),
          kind: relation.kind,
          sourceWorkId: createdWork.id,
          targetLabel: relation.targetLabel,
          targetProjectId: relation.targetProjectId,
          targetRecordId: relation.targetRecordId,
        })),
        {
          createdAt: committedAt,
          id: crypto.randomUUID(),
          kind: "Origin",
          sourceWorkId: selection.sourceWork.id,
          targetLabel: createdWork.key,
          targetProjectId: createdWork.projectId,
          targetRecordId: createdWork.id,
        },
      ]);
    },
  };
}
