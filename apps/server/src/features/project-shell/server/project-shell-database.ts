import {
  projectLifecycleStatusSchema,
  resolveProjectShellConfiguration,
  starterConfigurationSchema,
} from "@cantiara/api/project-shell";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { priorityMetricDefinition } from "@cantiara/db/schema/priority-metrics";
import { project, projectShortCode } from "@cantiara/db/schema/project";
import { and, asc, eq } from "drizzle-orm";

import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import { starterPriorityMetricDefinitionValues } from "../../priority-metrics/server/priority-metrics-database";
import {
  createProjectShell,
  type ProjectShellStore,
  ProjectShortCodeConflictError,
  ProjectShortCodeLockedError,
} from "./project-shell";

type ProjectDatabaseRecord = typeof project.$inferSelect;

function toRecord(record: ProjectDatabaseRecord) {
  const starterConfiguration = starterConfigurationSchema.parse(
    record.starterConfiguration,
  );
  return {
    configuration: resolveProjectShellConfiguration(
      record.configuration,
      starterConfiguration,
    ),
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    logo: record.logo,
    name: record.name,
    problem: record.problem,
    purpose: record.purpose,
    revision: record.revision,
    scope: record.scope,
    shortCode: record.shortCode,
    starterConfiguration,
    status: projectLifecycleStatusSchema.parse(record.status),
    targetDate: record.targetDate,
    updatedAt: record.updatedAt.toISOString(),
    workCount: record.workCount,
    workspaceId: record.workspaceId,
  } satisfies Awaited<ReturnType<ProjectShellStore["create"]>>;
}

async function updateShortCodeRecord(
  transaction: MutationDatabaseExecutor,
  workspaceId: string,
  projectId: string,
  current: ProjectDatabaseRecord,
  shortCode: string,
) {
  const [updated] = await transaction
    .update(project)
    .set({
      revision: current.revision + 1,
      shortCode,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(project.id, projectId),
        eq(project.workspaceId, workspaceId),
        eq(project.workCount, 0),
        eq(project.revision, current.revision),
      ),
    )
    .returning();
  if (!updated) {
    throw new ProjectShortCodeLockedError();
  }
  return toRecord(updated);
}

export function createDatabaseProjectShell(database: Database) {
  const store: ProjectShellStore = {
    async findWorkspaceId(accountId) {
      const [record] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      return record?.id ?? null;
    },

    create(workspaceId, input) {
      return database.transaction(async (transaction) => {
        const id = crypto.randomUUID();
        const committedAt = new Date();
        const [created] = await transaction
          .insert(project)
          .values({
            configuration: input.configuration,
            id,
            logo: input.logo,
            name: input.name,
            problem: input.problem,
            purpose: input.purpose,
            scope: input.scope,
            shortCode: input.shortCode,
            starterConfiguration: input.starterConfiguration,
            status: input.status,
            targetDate: input.targetDate,
            updatedAt: committedAt,
            workspaceId,
          })
          .onConflictDoNothing({
            target: [project.workspaceId, project.shortCode],
          })
          .returning();

        if (!created) {
          throw new ProjectShortCodeConflictError(input.shortCode);
        }

        const [reservation] = await transaction
          .insert(projectShortCode)
          .values({
            id: crypto.randomUUID(),
            projectId: id,
            reservedAt: committedAt,
            shortCode: input.shortCode,
            workspaceId,
          })
          .onConflictDoNothing({
            target: [projectShortCode.workspaceId, projectShortCode.shortCode],
          })
          .returning({ id: projectShortCode.id });

        if (!reservation) {
          throw new ProjectShortCodeConflictError(input.shortCode);
        }

        const priorityMetricValues = starterPriorityMetricDefinitionValues(
          id,
          input.starterConfiguration,
          committedAt,
        );
        if (priorityMetricValues) {
          await transaction
            .insert(priorityMetricDefinition)
            .values(priorityMetricValues);
        }

        return toRecord(created);
      });
    },

    async find(workspaceId, projectId) {
      const [record] = await database
        .select()
        .from(project)
        .where(
          and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)),
        )
        .limit(1);
      return record ? toRecord(record) : null;
    },

    async list(workspaceId) {
      const records = await database
        .select()
        .from(project)
        .where(eq(project.workspaceId, workspaceId))
        .orderBy(asc(project.createdAt));
      return records.map(toRecord);
    },

    recordFirstWork(workspaceId, projectId) {
      return database.transaction(async (transaction) => {
        const [current] = await transaction
          .select()
          .from(project)
          .where(
            and(
              eq(project.id, projectId),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .for("update");
        if (!current) {
          return null;
        }
        if (current.workCount > 0) {
          return toRecord(current);
        }

        const [updated] = await transaction
          .update(project)
          .set({
            updatedAt: new Date(),
            workCount: 1,
          })
          .where(eq(project.id, projectId))
          .returning();
        return updated ? toRecord(updated) : null;
      });
    },

    updateShortCode(workspaceId, projectId, shortCode) {
      return database.transaction(async (transaction) => {
        const [current] = await transaction
          .select()
          .from(project)
          .where(
            and(
              eq(project.id, projectId),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .for("update");
        if (!current) {
          return null;
        }
        if (current.workCount > 0) {
          throw new ProjectShortCodeLockedError();
        }
        if (current.shortCode === shortCode) {
          return toRecord(current);
        }

        const [existingReservation] = await transaction
          .select({ projectId: projectShortCode.projectId })
          .from(projectShortCode)
          .where(
            and(
              eq(projectShortCode.workspaceId, workspaceId),
              eq(projectShortCode.shortCode, shortCode),
            ),
          )
          .limit(1);
        if (existingReservation?.projectId === projectId) {
          return updateShortCodeRecord(
            transaction,
            workspaceId,
            projectId,
            current,
            shortCode,
          );
        }

        const [reservation] = await transaction
          .insert(projectShortCode)
          .values({
            id: crypto.randomUUID(),
            projectId,
            shortCode,
            workspaceId,
          })
          .onConflictDoNothing({
            target: [projectShortCode.workspaceId, projectShortCode.shortCode],
          })
          .returning({ id: projectShortCode.id });
        if (!reservation) {
          throw new ProjectShortCodeConflictError(shortCode);
        }

        return updateShortCodeRecord(
          transaction,
          workspaceId,
          projectId,
          current,
          shortCode,
        );
      });
    },
  };

  return createProjectShell({ store });
}
