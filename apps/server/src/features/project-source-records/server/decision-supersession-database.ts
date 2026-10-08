// biome-ignore-all lint/performance/noAwaitInLoops: Ordered writes share one atomic PostgreSQL transaction.
import {
  type DecisionSupersessionAccess,
  type DecisionSupersessionGraph,
  type DecisionSupersessionSelection,
  decisionSupersessionCommandSchema,
  decisionSupersessionGraphSchema,
  decisionSupersessionSelectionSchema,
} from "@cantiara/api/decision-supersession";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  decisionRecordSchema,
  ProjectSourceRecordConflictError,
} from "@cantiara/api/project-source-records";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision, decisionSupersession } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory, mutationTarget } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull } from "drizzle-orm";
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

function conflict(projectId: string): never {
  throw new ProjectSourceRecordConflictError(projectId);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One graph guard covers full replacement and explicit removal.
function validate(
  graph: DecisionSupersessionGraph,
  input: DecisionSupersessionSelection,
) {
  const successor = graph.records.find(
    (record) => record.id === input.successorId,
  );
  if (
    !successor ||
    (input.operation === "supersede" && successor.life !== "Valid")
  ) {
    conflict(input.projectId);
  }
  const nextByOld = new Map(
    graph.relations.map((relation) => [
      relation.predecessorId,
      relation.successorId,
    ]),
  );
  for (const id of input.predecessorIds) {
    const predecessor = graph.records.find((record) => record.id === id);
    if (!predecessor) {
      conflict(input.projectId);
    }
    if (input.operation === "remove") {
      if (
        nextByOld.get(id) !== input.successorId ||
        predecessor.life !== "Superseded"
      ) {
        conflict(input.projectId);
      }
      continue;
    }
    if (predecessor.life !== "Valid" || nextByOld.has(id)) {
      conflict(input.projectId);
    }
    const visited = new Set<string>();
    let cursor: string | undefined = input.successorId;
    while (cursor) {
      if (cursor === id || visited.has(cursor)) {
        conflict(input.projectId);
      }
      visited.add(cursor);
      cursor = nextByOld.get(cursor);
    }
  }
}

function graphTargetId(projectId: string) {
  return `decision-supersession:${projectId}`;
}

function adapter(
  accountId: string,
  projectId: string,
): MutationDatabaseTargetAdapter<DecisionSupersessionGraph> {
  return {
    async find(executor, targetId, lock) {
      const query = executor
        .select({ project })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      const [owned] = lock
        ? await query.for("update", { of: project })
        : await query;
      if (!owned || (lock && owned.project.archivedAt !== null)) {
        return null;
      }
      const recordsQuery = executor
        .select()
        .from(decision)
        .where(eq(decision.projectId, projectId))
        .orderBy(asc(decision.id));
      const rows = lock ? await recordsQuery.for("update") : await recordsQuery;
      const relations = await executor
        .select()
        .from(decisionSupersession)
        .where(eq(decisionSupersession.projectId, projectId))
        .orderBy(asc(decisionSupersession.predecessorId));
      const [marker] = await executor
        .select()
        .from(mutationTarget)
        .where(eq(mutationTarget.id, targetId));
      const evidence = await executor
        .select({
          relation: usageLink,
          id: usageLink.id,
          decisionId: usageLink.surfaceRecordId,
          title: document.title,
          location: usageLink.location,
          revision: document.revision,
        })
        .from(usageLink)
        .innerJoin(document, eq(usageLink.sourceRecordId, document.id))
        .where(
          and(
            eq(usageLink.surfaceRecordType, "Decision"),
            eq(usageLink.sourceRecordType, "Document"),
            eq(usageLink.workspaceId, owned.project.workspaceId),
          ),
        );
      const workEvidence = await executor
        .select({
          relation: workRelation,
          id: workRelation.id,
          decisionId: workRelation.targetRecordId,
          title: work.title,
          revision: work.revision,
        })
        .from(workRelation)
        .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(workRelation.targetProjectId, projectId),
            eq(project.workspaceId, owned.project.workspaceId),
            eq(workRelation.targetRecordType, "Decision"),
            eq(workRelation.kind, "Evidence"),
            isNull(workRelation.deletedAt),
          ),
        );
      const savedTransition = decisionSupersessionGraphSchema
        .pick({ transition: true })
        .parse(marker?.value ?? {});
      const graph: DecisionSupersessionGraph = {
        ...savedTransition,
        records: rows.map((row) =>
          decisionRecordSchema.parse({
            ...row,
            sourceType: "Decision",
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
          }),
        ),
        relations: relations.map(({ projectId: _projectId, ...relation }) => ({
          ...relation,
          occurredAt: relation.occurredAt.toISOString(),
        })),
        evidence: (
          await Promise.all([
            ...evidence.map(async (item) => ({
              relationFingerprint: await fingerprintMutationPayload(
                JSON.stringify(item.relation),
              ),
              id: item.id,
              revision: item.revision,
              decisionId: item.decisionId,
              title: item.title,
              excerpt:
                typeof item.location === "object" &&
                item.location !== null &&
                "excerpt" in item.location &&
                typeof item.location.excerpt === "string"
                  ? item.location.excerpt
                  : null,
            })),
            ...workEvidence.map(async (item) => ({
              relationFingerprint: await fingerprintMutationPayload(
                JSON.stringify(item.relation),
              ),
              id: item.id,
              revision: item.revision,
              decisionId: item.decisionId,
              title: item.title,
              excerpt: null,
            })),
          ])
        )
          .filter((item) => rows.some((row) => row.id === item.decisionId))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        revision: marker?.revision ?? 0,
        readOnly: owned.project.archivedAt !== null,
      };
      return { id: targetId, revision: graph.revision, value: graph };
    },
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Lives, edges and history must commit or rollback together.
    async update(executor, input) {
      const previous = await this.find(executor, input.targetId, false);
      if (!previous) {
        return null;
      }
      const next = input.nextValue;
      for (const record of next.records) {
        const old = previous.value.records.find(
          (candidate) => candidate.id === record.id,
        );
        if (!old || old.life === record.life) {
          continue;
        }
        const [written] = await executor
          .update(decision)
          .set({
            life: record.life,
            revision: record.revision,
            updatedAt: input.committedAt,
          })
          .where(
            and(
              eq(decision.id, record.id),
              eq(decision.projectId, projectId),
              eq(decision.revision, old.revision),
            ),
          )
          .returning({ id: decision.id });
        if (!written) {
          conflict(projectId);
        }
        await executor.insert(mutationHistory).values({
          id: crypto.randomUUID(),
          targetId: record.id,
          revision: record.revision,
          actorType: "User",
          actorId: accountId,
          originKind: "human",
          clientIdempotencyKey: input.idempotencyKey.key,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: {
            decision: old,
            relations: previous.value.relations.filter(
              (edge) => edge.predecessorId === old.id,
            ),
          },
          nextValue: {
            transition: next.transition,
            decision: record,
            relations: next.relations.filter(
              (edge) => edge.predecessorId === record.id,
            ),
          },
          occurredAt: input.committedAt,
        });
      }
      for (const edge of previous.value.relations) {
        if (
          !next.relations.some(
            (candidate) => candidate.predecessorId === edge.predecessorId,
          )
        ) {
          await executor
            .delete(decisionSupersession)
            .where(
              and(
                eq(decisionSupersession.projectId, projectId),
                eq(decisionSupersession.predecessorId, edge.predecessorId),
              ),
            );
        }
      }
      for (const edge of next.relations) {
        if (
          !previous.value.relations.some(
            (candidate) => candidate.predecessorId === edge.predecessorId,
          )
        ) {
          await executor
            .insert(decisionSupersession)
            .values({ ...edge, projectId, occurredAt: input.committedAt });
        }
      }
      await executor
        .insert(mutationTarget)
        .values({
          id: input.targetId,
          revision: next.revision,
          value: { transition: next.transition },
        })
        .onConflictDoUpdate({
          target: mutationTarget.id,
          set: {
            revision: next.revision,
            value: { transition: next.transition },
            updatedAt: input.committedAt,
          },
        });
      return { id: input.targetId, revision: next.revision, value: next };
    },
  };
}

async function readGraph(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
) {
  const target = await adapter(accountId, projectId).find(
    executor,
    graphTargetId(projectId),
    false,
  );
  return target?.value ?? null;
}

export function createDatabaseDecisionSupersession(
  database: Database,
): DecisionSupersessionAccess {
  return {
    async history(accountId, projectId) {
      return await database.transaction(
        async (transaction) => {
          if (!(await readGraph(transaction, accountId, projectId))) {
            return null;
          }
          const events = await transaction
            .select({ nextValue: mutationHistory.nextValue })
            .from(mutationHistory)
            .where(eq(mutationHistory.targetId, graphTargetId(projectId)))
            .orderBy(asc(mutationHistory.revision));
          return events.flatMap((event) => {
            const graph = decisionSupersessionGraphSchema.parse(
              event.nextValue,
            );
            return graph.transition ? [graph.transition] : [];
          });
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    read: (accountId, projectId) =>
      database.transaction(
        (transaction) => readGraph(transaction, accountId, projectId),
        { isolationLevel: "repeatable read", accessMode: "read only" },
      ),
    async preview(accountId, rawInput) {
      const input = decisionSupersessionSelectionSchema.parse(rawInput);
      return await database.transaction(
        async (transaction) => {
          const graph = await readGraph(
            transaction,
            accountId,
            input.projectId,
          );
          if (!graph || graph.readOnly) {
            return null;
          }
          validate(graph, input);
          return {
            graph,
            changes: input.predecessorIds.map((id) => ({
              id,
              before: input.operation === "supersede" ? "Valid" : "Superseded",
              after: input.operation === "supersede" ? "Superseded" : "Valid",
            })),
            command: {
              ...input,
              baseRevision: graph.revision,
              previewFingerprint: await fingerprintMutationPayload(graph),
            },
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async commit(accountId, rawInput) {
      const input = decisionSupersessionCommandSchema.parse(rawInput);
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      const targetId = graphTargetId(input.projectId);
      // Replay also rechecks current ownership; the mutation receipt itself is not an access grant.
      const current = await readGraph(database, accountId, input.projectId);
      if (!current) {
        return null;
      }
      try {
        const receipt = await createDatabaseMutationContract(database, {
          target: adapter(accountId, input.projectId),
        }).mutate(
          {
            actor: { type: "User", actorId: accountId },
            kind: "human",
            targetId,
            baseRevision,
            clientIdempotencyKey,
            payload,
          },
          async ({ currentValue, committedAt }) => {
            if (
              (await fingerprintMutationPayload(currentValue)) !==
              input.previewFingerprint
            ) {
              conflict(input.projectId);
            }
            validate(currentValue, input);
            const selected = new Set(input.predecessorIds);
            return {
              ...currentValue,
              revision: currentValue.revision + 1,
              transition: {
                operation: input.operation,
                predecessorIds: input.predecessorIds,
                successorId: input.successorId,
                rationale: input.rationale,
                actorId: accountId,
                occurredAt: committedAt,
              },
              records: currentValue.records.map((record) =>
                selected.has(record.id)
                  ? {
                      ...record,
                      life:
                        input.operation === "supersede"
                          ? ("Superseded" as const)
                          : ("Valid" as const),
                      revision: record.revision + 1,
                      updatedAt: committedAt,
                    }
                  : record,
              ),
              relations:
                input.operation === "remove"
                  ? currentValue.relations.filter(
                      (edge) => !selected.has(edge.predecessorId),
                    )
                  : [
                      ...currentValue.relations,
                      ...input.predecessorIds.map((predecessorId) => ({
                        predecessorId,
                        successorId: input.successorId,
                        rationale: input.rationale,
                        actorId: accountId,
                        occurredAt: committedAt,
                      })),
                    ].sort((a, b) =>
                      a.predecessorId.localeCompare(b.predecessorId),
                    ),
            };
          },
        );
        return {
          id: receipt.id,
          committedAt: receipt.committedAt,
          graph: receipt.nextValue,
        };
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          conflict(input.projectId);
        }
        throw error;
      }
    },
  };
}
