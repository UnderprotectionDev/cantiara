import type { ProjectBacklogPresentation } from "@cantiara/api/backlog";
import {
  projectBacklogPresentationSchema,
  saveBacklogPresentationInputSchema,
} from "@cantiara/api/backlog";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import { workspace } from "@cantiara/db/schema/auth";
import { projectBacklogPresentation } from "@cantiara/db/schema/backlog";
import { project } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";
import type {
  MutationDatabaseExecutor,
  MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

async function findPresentation(
  executor: MutationDatabaseExecutor,
  projectId: string,
  lock: boolean,
): Promise<ProjectBacklogPresentation> {
  const query = executor
    .select()
    .from(projectBacklogPresentation)
    .where(eq(projectBacklogPresentation.projectId, projectId))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
  return projectBacklogPresentationSchema.parse({
    projectId,
    revision: record?.revision ?? 0,
    saved: record?.saved ?? null,
  });
}

function toTarget(
  presentation: ProjectBacklogPresentation,
): MutationTarget<ProjectBacklogPresentation> {
  return {
    id: presentation.projectId,
    revision: presentation.revision,
    value: presentation,
  };
}

export function createBacklogPresentationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<ProjectBacklogPresentation> {
  return {
    find: async (executor, targetId, lock, context) => {
      if (context?.payload !== undefined) {
        const parsed = saveBacklogPresentationInputSchema.safeParse(
          context.payload,
        );
        if (!parsed.success || parsed.data.projectId !== targetId) {
          return null;
        }
      }
      if (!(await findOwnedProject(executor, accountId, targetId, lock))) {
        return null;
      }
      return toTarget(await findPresentation(executor, targetId, lock));
    },

    async update(executor, input) {
      if (
        input.nextValue.projectId !== input.targetId ||
        !input.nextValue.saved
      ) {
        return null;
      }
      if (
        !(await findOwnedProject(executor, accountId, input.targetId, true))
      ) {
        return null;
      }
      const current = await findPresentation(executor, input.targetId, true);
      if (current.revision !== input.expectedRevision) {
        return null;
      }
      const revision = input.expectedRevision + 1;
      const [record] = current.saved
        ? await executor
            .update(projectBacklogPresentation)
            .set({
              revision,
              saved: input.nextValue.saved,
              updatedAt: input.committedAt,
            })
            .where(
              and(
                eq(projectBacklogPresentation.projectId, input.targetId),
                eq(projectBacklogPresentation.revision, input.expectedRevision),
              ),
            )
            .returning()
        : await executor
            .insert(projectBacklogPresentation)
            .values({
              projectId: input.targetId,
              revision,
              saved: input.nextValue.saved,
              updatedAt: input.committedAt,
            })
            .onConflictDoNothing({
              target: projectBacklogPresentation.projectId,
            })
            .returning();
      return record
        ? toTarget(
            projectBacklogPresentationSchema.parse({
              projectId: input.targetId,
              revision: record.revision,
              saved: record.saved,
            }),
          )
        : null;
    },
  };
}
