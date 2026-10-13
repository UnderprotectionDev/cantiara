import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import { ProjectSourceRecordConflictError } from "@cantiara/api/project-source-records";
import {
  openRiskSignal,
  type RiskContextRelation,
  type RiskContextRelationInput,
  type RiskSignalsAccess,
  type RiskSourceEvent,
  riskAttentionSignalSchema,
  riskContextRelationInputSchema,
} from "@cantiara/api/risk-signals";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { focusPeriod } from "@cantiara/db/schema/focus-period";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  risk,
  riskAttentionSignal,
  riskContextRelation,
} from "@cantiara/db/schema/risk";
import { and, asc, eq } from "drizzle-orm";
import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

export async function produceRiskSignal(
  executor: MutationDatabaseExecutor,
  source: Parameters<typeof openRiskSignal>[0],
  sourceEvent: RiskSourceEvent,
  occurredAt: Date,
  contextStatus?: string,
) {
  const signal = openRiskSignal(source, sourceEvent, contextStatus);
  if (!signal) {
    return;
  }
  await executor
    .insert(riskAttentionSignal)
    .values({
      ...signal,
      signalId: `open-risk:${sourceEvent.id}`,
      occurredAt,
    })
    .onConflictDoNothing({ target: riskAttentionSignal.signalId });
}

interface RelationValue {
  relation: RiskContextRelation | null;
}

async function endpoints(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: RiskContextRelationInput,
  lock: boolean,
) {
  const projectQuery = executor
    .select()
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(project.id, input.projectId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  const [owned] = lock
    ? await projectQuery.for("update", { of: project })
    : await projectQuery;
  if (!owned || owned.project.archivedAt) {
    return null;
  }
  const riskQuery = executor
    .select()
    .from(risk)
    .where(and(eq(risk.id, input.riskId), eq(risk.projectId, input.projectId)));
  const [source] = lock ? await riskQuery.for("update") : await riskQuery;
  if (!source) {
    return null;
  }
  if (input.targetType === "Project Release") {
    const query = executor
      .select()
      .from(projectRelease)
      .where(
        and(
          eq(projectRelease.id, input.targetId),
          eq(projectRelease.projectId, input.projectId),
        ),
      );
    const [target] = lock ? await query.for("update") : await query;
    return target ? { source, status: target.status } : null;
  }
  const query = executor
    .select()
    .from(focusPeriod)
    .where(
      and(
        eq(focusPeriod.id, input.targetId),
        eq(focusPeriod.workspaceId, owned.project.workspaceId),
      ),
    );
  const [target] = lock ? await query.for("update") : await query;
  return target ? { source, status: target.status } : null;
}

function relationTarget(
  accountId: string,
  selection: RiskContextRelationInput,
): MutationDatabaseTargetAdapter<RelationValue> {
  return {
    async find(executor, targetId, lock) {
      if (!(await endpoints(executor, accountId, selection, lock))) {
        return null;
      }
      const [row] = await executor
        .select()
        .from(riskContextRelation)
        .where(eq(riskContextRelation.id, targetId));
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          relation: row
            ? {
                id: row.id,
                riskId: row.riskId,
                targetType: selection.targetType,
                targetId: selection.targetId,
                revision: row.revision,
              }
            : null,
        },
      };
    },
    async update(executor, input) {
      const { relation } = input.nextValue;
      const current = await endpoints(executor, accountId, selection, true);
      if (!(relation && current)) {
        return null;
      }
      const [row] = await executor
        .insert(riskContextRelation)
        .values({
          id: input.targetId,
          riskId: selection.riskId,
          projectReleaseId:
            selection.targetType === "Project Release"
              ? selection.targetId
              : null,
          focusPeriodId:
            selection.targetType === "Focus Period" ? selection.targetId : null,
          revision: input.expectedRevision + 1,
          createdAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        throw new MutationConflictError(input.targetId);
      }
      await produceRiskSignal(
        executor,
        current.source,
        {
          type: "related-context",
          id: row.id,
          targetType: selection.targetType,
          targetId: selection.targetId,
        },
        input.committedAt,
        current.status,
      );
      return { id: row.id, revision: row.revision, value: { relation } };
    },
  };
}

export async function relateRiskContext(
  database: Database,
  accountId: string,
  rawInput: RiskContextRelationInput,
) {
  const input = riskContextRelationInputSchema.parse(rawInput);
  const { baseRevision, clientIdempotencyKey, ...selection } = input;
  const targetId = `risk-context:${await fingerprintMutationPayload(selection)}`;
  const mutation = createDatabaseMutationContract<RelationValue>(database, {
    target: relationTarget(accountId, input),
  });
  try {
    const receipt = await mutation.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision,
        clientIdempotencyKey,
        kind: "human",
        payload: selection,
        targetId,
      },
      ({ currentValue, currentRevision }) => {
        if (currentValue.relation) {
          throw new MutationConflictError(targetId);
        }
        return {
          relation: {
            id: targetId,
            riskId: input.riskId,
            targetType: input.targetType,
            targetId: input.targetId,
            revision: currentRevision + 1,
          },
        };
      },
    );
    return receipt.nextValue.relation;
  } catch (error) {
    if (error instanceof MutationTargetNotFoundError) {
      return null;
    }
    if (
      error instanceof MutationConflictError ||
      error instanceof MutationStaleBaseRevisionError
    ) {
      throw new ProjectSourceRecordConflictError(input.riskId, {
        cause: error,
      });
    }
    throw error;
  }
}

export function createDatabaseRiskSignals(
  database: Database,
): RiskSignalsAccess {
  return {
    relate: (accountId, input) => relateRiskContext(database, accountId, input),
    async list(accountId: string, projectId: string) {
      const [owned] = await database
        .select({ id: project.id })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      if (!owned) {
        return null;
      }
      const rows = await database
        .select()
        .from(riskAttentionSignal)
        .where(eq(riskAttentionSignal.projectId, projectId))
        .orderBy(
          asc(riskAttentionSignal.occurredAt),
          asc(riskAttentionSignal.signalId),
        );
      return rows.map((row) =>
        riskAttentionSignalSchema.parse({
          ...row,
          occurredAt: row.occurredAt.toISOString(),
        }),
      );
    },
  };
}
