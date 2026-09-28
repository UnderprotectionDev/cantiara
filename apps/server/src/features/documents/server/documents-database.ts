import {
  type CreateDocumentInput,
  type Document,
  DocumentStaleRevisionError,
  type DocumentsAccess,
  DocumentUnavailableError,
  type UpdateDocumentInput,
} from "@cantiara/api/documents";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { and, desc, eq, sql } from "drizzle-orm";

function toDocument(row: typeof document.$inferSelect): Document {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    type: row.type as Document["type"],
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createDatabaseDocuments(database: Database): DocumentsAccess {
  async function ownedProject(accountId: string, projectId: string) {
    const [row] = await database
      .select({ id: project.id })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
      )
      .limit(1);
    return row ?? null;
  }

  async function get(accountId: string, documentId: string) {
    const [row] = await database
      .select({ document })
      .from(document)
      .innerJoin(project, eq(document.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(document.id, documentId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    return row ? toDocument(row.document) : null;
  }

  return {
    async create(accountId: string, input: CreateDocumentInput) {
      if (!(await ownedProject(accountId, input.projectId))) {
        throw new DocumentUnavailableError();
      }
      const [created] = await database
        .insert(document)
        .values({ ...input, id: crypto.randomUUID() })
        .returning();
      if (!created) {
        throw new Error("Document creation failed.");
      }
      return toDocument(created);
    },
    get,
    async list(accountId: string, projectId: string) {
      if (!(await ownedProject(accountId, projectId))) {
        throw new DocumentUnavailableError();
      }
      const rows = await database
        .select({ document })
        .from(document)
        .innerJoin(project, eq(document.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(document.projectId, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .orderBy(desc(document.updatedAt));
      return rows.map(({ document: row }) => toDocument(row));
    },
    async update(accountId: string, input: UpdateDocumentInput) {
      const current = await get(accountId, input.documentId);
      if (!current) {
        throw new DocumentUnavailableError();
      }
      const [updated] = await database
        .update(document)
        .set({
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.body === undefined ? {} : { body: input.body }),
          ...(input.type === undefined ? {} : { type: input.type }),
          revision: sql`${document.revision} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.revision, input.baseRevision),
          ),
        )
        .returning();
      if (!updated) {
        throw new DocumentStaleRevisionError();
      }
      return toDocument(updated);
    },
  };
}
