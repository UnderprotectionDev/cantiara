import {
  createProjectGoalInputSchema,
  ProjectGoalConflictError,
  type ProjectGoalRecord,
  type ProjectGoalsAccess,
  projectGoalInputSchema,
  projectGoalRecordSchema,
  projectGoalsProjectInputSchema,
  updateProjectGoalInputSchema,
} from "@cantiara/api/project-goals";
import type { Database } from "@cantiara/db";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { and, asc, eq } from "drizzle-orm";
import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

import { ownedProject } from "./project-goal-access";
import { createDatabaseProjectGoalMembership } from "./project-goal-membership-database";

interface GoalValue {
  projectGoal: ProjectGoalRecord | null;
}
function toRecord(row: typeof projectGoal.$inferSelect) {
  return projectGoalRecordSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
function goalTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<GoalValue> {
  return {
    async find(executor, targetId, lock, context) {
      const payload = context?.payload;
      const projectId =
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        "projectId" in payload
          ? payload.projectId
          : null;
      if (
        typeof projectId !== "string" ||
        !(await ownedProject(executor, accountId, projectId, lock))
      ) {
        return null;
      }
      const query = executor
        .select()
        .from(projectGoal)
        .where(
          and(
            eq(projectGoal.id, targetId),
            eq(projectGoal.projectId, projectId),
          ),
        )
        .limit(1);
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: { projectGoal: row ? toRecord(row) : null },
      };
    },
    async update(executor, input) {
      const record = input.nextValue.projectGoal;
      if (
        !record ||
        record.id !== input.targetId ||
        !(await ownedProject(executor, accountId, record.projectId, true))
      ) {
        return null;
      }
      const values = {
        title: record.title,
        description: record.description,
        intendedOutcome: record.intendedOutcome,
        observedOutcomeLearning: record.observedOutcomeLearning,
        revision: input.expectedRevision + 1,
        updatedAt: input.committedAt,
      };
      const [row] =
        input.expectedRevision === 0
          ? await executor
              .insert(projectGoal)
              .values({
                ...values,
                id: record.id,
                projectId: record.projectId,
                createdAt: input.committedAt,
              })
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(projectGoal)
              .set(values)
              .where(
                and(
                  eq(projectGoal.id, record.id),
                  eq(projectGoal.projectId, record.projectId),
                  eq(projectGoal.revision, input.expectedRevision),
                ),
              )
              .returning();
      return row
        ? {
            id: row.id,
            revision: row.revision,
            value: { projectGoal: toRecord(row) },
          }
        : null;
    },
  };
}
export function createDatabaseProjectGoals(
  database: Database,
): ProjectGoalsAccess {
  async function save(
    accountId: string,
    rawInput:
      | Parameters<ProjectGoalsAccess["create"]>[1]
      | Parameters<ProjectGoalsAccess["update"]>[1],
    operation: "create" | "update",
  ) {
    const input = (
      operation === "create"
        ? createProjectGoalInputSchema
        : updateProjectGoalInputSchema
    ).parse(rawInput);
    const { baseRevision, clientIdempotencyKey, ...fields } = input;
    const mutation = createDatabaseMutationContract<GoalValue>(database, {
      target: goalTarget(accountId),
    });
    try {
      const receipt = await mutation.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          targetId: input.id,
          baseRevision,
          clientIdempotencyKey,
          payload: { ...fields, operation },
        },
        ({ currentValue, currentRevision, committedAt }) => {
          const current = currentValue.projectGoal;
          if (
            (operation === "create" && current) ||
            (operation === "update" && !current)
          ) {
            throw new MutationConflictError(input.id);
          }
          return {
            projectGoal: projectGoalRecordSchema.parse({
              ...fields,
              createdAt: current?.createdAt ?? committedAt,
              updatedAt: committedAt,
              revision: currentRevision + 1,
            }),
          };
        },
      );
      return receipt.nextValue.projectGoal;
    } catch (error) {
      if (error instanceof MutationTargetNotFoundError) {
        return null;
      }
      if (
        error instanceof MutationConflictError ||
        error instanceof MutationStaleBaseRevisionError
      ) {
        throw new ProjectGoalConflictError(
          "Project Goal changed. Reload before saving.",
          { cause: error },
        );
      }
      throw error;
    }
  }
  return {
    membership: createDatabaseProjectGoalMembership(database),
    create: (accountId, input) => save(accountId, input, "create"),
    update: (accountId, input) => save(accountId, input, "update"),
    async find(accountId, rawInput) {
      const input = projectGoalInputSchema.parse(rawInput);
      if (!(await ownedProject(database, accountId, input.projectId, false))) {
        return null;
      }
      const [row] = await database
        .select()
        .from(projectGoal)
        .where(
          and(
            eq(projectGoal.id, input.id),
            eq(projectGoal.projectId, input.projectId),
          ),
        )
        .limit(1);
      return row ? toRecord(row) : null;
    },
    async list(accountId, projectId) {
      const input = projectGoalsProjectInputSchema.parse({ projectId });
      const owned = await ownedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      if (!owned) {
        return null;
      }
      const rows = await database
        .select()
        .from(projectGoal)
        .where(eq(projectGoal.projectId, input.projectId))
        .orderBy(asc(projectGoal.createdAt), asc(projectGoal.id));
      return {
        records: rows.map(toRecord),
        readOnly: owned.archivedAt !== null,
      };
    },
  };
}
