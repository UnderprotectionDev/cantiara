import type {
  BacklogMutationContracts,
  BacklogOrderMutationValue,
  ProjectBacklogOrder,
  ProjectBacklogPresentation,
} from "@cantiara/api/backlog";
import {
  projectBacklogOrderSchema,
  updateBacklogOrderInputSchema,
} from "@cantiara/api/backlog";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq } from "drizzle-orm";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { isBacklogMember } from "./backlog-membership";
import { applyBacklogOrder, normalizeBacklogOrder } from "./backlog-order";
import { findOwnedBacklogProject } from "./backlog-owned-project";
import { createBacklogPresentationTarget } from "./backlog-presentation-mutation-database";

interface BacklogState {
  activeWorkIds: string[];
  allWorkIds: string[];
  fullWorkIds: string[];
  order: ProjectBacklogOrder;
  stored: typeof projectBacklogOrder.$inferSelect | null;
}

async function loadBacklogState(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
): Promise<BacklogState | null> {
  if (!(await findOwnedBacklogProject(executor, accountId, projectId, lock))) {
    return null;
  }

  const storedQuery = executor
    .select()
    .from(projectBacklogOrder)
    .where(eq(projectBacklogOrder.projectId, projectId))
    .limit(1);
  const storedRecords = lock
    ? await storedQuery.for("update")
    : await storedQuery;
  const stored = storedRecords[0] ?? null;
  const records = await executor
    .select({
      archivedAt: work.archivedAt,
      id: work.id,
      status: work.status,
      trashedAt: work.trashedAt,
    })
    .from(work)
    .where(eq(work.projectId, projectId))
    .orderBy(asc(work.number));
  const allWorkIds = records.map((record) => record.id);
  const activeWorkIds = records
    .filter(isBacklogMember)
    .map((record) => record.id);
  const fullWorkIds = normalizeBacklogOrder(stored?.workIds ?? [], allWorkIds);
  const activeWorkIdSet = new Set(activeWorkIds);
  const order = projectBacklogOrderSchema.parse({
    projectId,
    revision: stored?.revision ?? 0,
    workIds: fullWorkIds.filter((workId) => activeWorkIdSet.has(workId)),
  });

  return { activeWorkIds, allWorkIds, fullWorkIds, order, stored };
}

function toMutationTarget(
  projectId: string,
  state: BacklogState,
): MutationTarget<BacklogOrderMutationValue> {
  return {
    id: projectId,
    revision: state.order.revision,
    value: { order: state.order },
  };
}

function createBacklogOrderTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<BacklogOrderMutationValue> {
  return {
    find: async (executor, targetId, lock, context) => {
      if (context?.payload !== undefined) {
        const parsed = updateBacklogOrderInputSchema.safeParse(context.payload);
        if (!parsed.success || parsed.data.projectId !== targetId) {
          return null;
        }
      }
      const state = await loadBacklogState(executor, accountId, targetId, lock);
      return state ? toMutationTarget(targetId, state) : null;
    },

    async update(executor, input) {
      const nextOrder = input.nextValue.order;
      if (!nextOrder || nextOrder.projectId !== input.targetId) {
        return null;
      }

      const state = await loadBacklogState(
        executor,
        accountId,
        input.targetId,
        true,
      );
      if (!state || state.order.revision !== input.expectedRevision) {
        return null;
      }

      const fullWorkIds = applyBacklogOrder(
        state.fullWorkIds,
        state.allWorkIds,
        state.activeWorkIds,
        nextOrder.workIds,
      );
      const revision = input.expectedRevision + 1;
      let stored: typeof projectBacklogOrder.$inferSelect | undefined;
      if (state.stored) {
        const [updated] = await executor
          .update(projectBacklogOrder)
          .set({
            revision,
            updatedAt: input.committedAt,
            workIds: fullWorkIds,
          })
          .where(
            and(
              eq(projectBacklogOrder.projectId, input.targetId),
              eq(projectBacklogOrder.revision, input.expectedRevision),
            ),
          )
          .returning();
        stored = updated;
      } else if (input.expectedRevision === 0) {
        const [created] = await executor
          .insert(projectBacklogOrder)
          .values({
            projectId: input.targetId,
            revision,
            updatedAt: input.committedAt,
            workIds: fullWorkIds,
          })
          .onConflictDoNothing({ target: projectBacklogOrder.projectId })
          .returning();
        stored = created;
      }

      if (!stored) {
        return null;
      }

      const activeWorkIdSet = new Set(state.activeWorkIds);
      const order = projectBacklogOrderSchema.parse({
        projectId: input.targetId,
        revision: stored.revision,
        workIds: fullWorkIds.filter((workId) => activeWorkIdSet.has(workId)),
      });
      return {
        id: input.targetId,
        revision: stored.revision,
        value: { order },
      };
    },
  };
}

export function createDatabaseBacklogMutationContracts(
  database: Database,
): BacklogMutationContracts {
  return {
    savePresentation: (accountId) =>
      createDatabaseMutationContract<ProjectBacklogPresentation>(database, {
        target: createBacklogPresentationTarget(accountId),
      }),
    updateOrder: (accountId) =>
      createDatabaseMutationContract<BacklogOrderMutationValue>(database, {
        target: createBacklogOrderTarget(accountId),
      }),
  };
}
