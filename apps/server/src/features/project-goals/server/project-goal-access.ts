import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

export async function ownedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ id: project.id, archivedAt: project.archivedAt })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  const [row] = lock ? await query.for("update", { of: project }) : await query;
  return row && (!lock || row.archivedAt === null) ? row : null;
}
