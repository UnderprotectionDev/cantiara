import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

export async function findWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
  lock = false,
) {
  const query = executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  return record?.id ?? null;
}

export async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const workspaceId = await findWorkspaceId(executor, accountId, lock);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  return record ?? null;
}

export async function findOwnedDocument(
  executor: MutationDatabaseExecutor,
  accountId: string,
  documentId: string,
  lock: boolean,
) {
  const [ownership] = await executor
    .select({ projectId: document.projectId, workspaceId: workspace.id })
    .from(document)
    .leftJoin(project, eq(document.projectId, project.id))
    .innerJoin(
      workspace,
      eq(
        sql`coalesce(${document.workspaceId}, ${project.workspaceId})`,
        workspace.id,
      ),
    )
    .where(
      and(eq(document.id, documentId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  if (!ownership) {
    return null;
  }

  const ownedProject =
    ownership.projectId === null
      ? null
      : await findOwnedProject(executor, accountId, ownership.projectId, lock);
  if (
    ownership.projectId !== null &&
    (!ownedProject || ownedProject.archivedAt !== null)
  ) {
    return null;
  }

  const query = executor
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, documentId),
        ownership.projectId === null
          ? and(
              isNull(document.projectId),
              eq(document.workspaceId, ownership.workspaceId),
            )
          : eq(document.projectId, ownership.projectId),
      ),
    )
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  return record ? { ...record, projectId: ownership.projectId } : null;
}
