import type { Document } from "@cantiara/api/documents";
import { projectLifecycleStatusSchema } from "@cantiara/api/project-shell";
import {
  type DocumentDiscoveryAccess,
  documentMatchContext,
} from "@cantiara/api/record-discovery";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

export function createDatabaseDocumentDiscovery(
  database: Database,
  toDocument: (row: typeof document.$inferSelect) => Document,
): DocumentDiscoveryAccess {
  return {
    async discover(accountId, input) {
      const query = sql`plainto_tsquery('simple', ${input.query})`;
      const titleMatch = sql`to_tsvector('simple', ${document.title}) @@ ${query}`;
      const rows = await database
        .select({
          document,
          projectArchivedAt: project.archivedAt,
          projectName: project.name,
          projectStatus: project.status,
        })
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
          and(
            eq(workspace.ownerAccountId, accountId),
            input.archived
              ? or(
                  isNotNull(document.archivedAt),
                  isNotNull(project.archivedAt),
                )
              : and(isNull(document.archivedAt), isNull(project.archivedAt)),
            input.scope.kind === "wiki"
              ? isNull(document.projectId)
              : undefined,
            input.scope.kind === "project"
              ? eq(document.projectId, input.scope.projectId)
              : undefined,
            input.type ? eq(document.type, input.type) : undefined,
            input.folder ? eq(document.folder, input.folder) : undefined,
            input.query
              ? sql`to_tsvector('simple', ${document.title} || ' ' || ${document.body}) @@ ${query}`
              : undefined,
          ),
        )
        .orderBy(
          ...(input.query ? [desc(titleMatch)] : []),
          ...(input.currentProjectId
            ? [
                desc(
                  sql`coalesce(${document.projectId} = ${input.currentProjectId}, false)`,
                ),
              ]
            : []),
          asc(
            sql`case when ${document.archivedAt} is not null or ${project.archivedAt} is not null then 2 when ${project.status} in ('Completed', 'Abandoned') then 1 else 0 end`,
          ),
          asc(sql`case when ${project.status} = 'Abandoned' then 1 else 0 end`),
          desc(document.updatedAt),
          asc(document.id),
        );
      return rows.map(
        ({ document: row, projectArchivedAt, projectName, projectStatus }) => ({
          document: toDocument(row),
          projectArchivedAt: projectArchivedAt?.toISOString() ?? null,
          projectName,
          projectStatus: projectStatus
            ? projectLifecycleStatusSchema.parse(projectStatus)
            : null,
          ...documentMatchContext(row.title, row.body, input.query),
        }),
      );
    },
  };
}
