import {
  DocumentSectionCycleError,
  documentLiveDirectives,
} from "@cantiara/api/documents";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { eq, sql } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

export async function assertDocumentSectionAcyclic(
  executor: MutationDatabaseExecutor,
  accountId: string,
  documentId: string,
  body: string,
) {
  const rows = await executor
    .select({ body: document.body, id: document.id })
    .from(document)
    .leftJoin(project, eq(document.projectId, project.id))
    .innerJoin(
      workspace,
      eq(
        sql`coalesce(${document.workspaceId}, ${project.workspaceId})`,
        workspace.id,
      ),
    )
    .where(eq(workspace.ownerAccountId, accountId));
  const bodies = new Map(rows.map((row) => [row.id, row.body]));
  bodies.set(documentId, body);
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(currentId: string): boolean {
    if (visiting.has(currentId)) {
      return true;
    }
    if (visited.has(currentId)) {
      return false;
    }
    visiting.add(currentId);
    const currentBody = bodies.get(currentId) ?? "";
    for (const directive of documentLiveDirectives(currentBody)) {
      if (
        directive.kind === "Document section" &&
        bodies.has(directive.id) &&
        visit(directive.id)
      ) {
        return true;
      }
    }
    visiting.delete(currentId);
    visited.add(currentId);
    return false;
  }

  if ([...bodies.keys()].some(visit)) {
    throw new DocumentSectionCycleError();
  }
}
