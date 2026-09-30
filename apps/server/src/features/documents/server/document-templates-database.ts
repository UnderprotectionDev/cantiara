import type {
  DocumentTemplate,
  DocumentTemplateAccess,
  DocumentTemplateMutationContracts,
  DocumentTemplateMutationValue,
} from "@cantiara/api/document-templates";
import {
  createDocumentTemplateInputSchema,
  documentTemplateSchema,
  updateDocumentTemplateInputSchema,
} from "@cantiara/api/document-templates";
import {
  DocumentUnavailableError,
  documentSchema,
} from "@cantiara/api/documents";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { documentTemplate } from "@cantiara/db/schema/document-template";
import { project } from "@cantiara/db/schema/project";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { MutationStaleBaseRevisionError } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  findOwnedDocument,
  findOwnedProject,
  findWorkspaceId,
} from "./document-ownership-database";

function toTemplate(
  row: typeof documentTemplate.$inferSelect,
): DocumentTemplate {
  return documentTemplateSchema.parse({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    body: row.body,
    type: row.type,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function ownedScope(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string | null,
  lock: boolean,
) {
  if (projectId) {
    const ownedProject = await findOwnedProject(
      executor,
      accountId,
      projectId,
      lock,
    );
    return ownedProject && ownedProject.archivedAt === null
      ? { projectId, workspaceId: null }
      : null;
  }
  const workspaceId = await findWorkspaceId(executor, accountId);
  return workspaceId ? { projectId: null, workspaceId } : null;
}

export async function findOwnedDocumentTemplate(
  executor: MutationDatabaseExecutor,
  accountId: string,
  templateId: string,
  lock: boolean,
) {
  const [candidate] = await executor
    .select({ template: documentTemplate })
    .from(documentTemplate)
    .leftJoin(project, eq(documentTemplate.projectId, project.id))
    .innerJoin(
      workspace,
      eq(
        sql`coalesce(${project.workspaceId}, ${documentTemplate.workspaceId})`,
        workspace.id,
      ),
    )
    .where(
      and(
        eq(documentTemplate.id, templateId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  if (
    !(
      candidate &&
      (await ownedScope(
        executor,
        accountId,
        candidate.template.projectId,
        lock,
      ))
    )
  ) {
    return null;
  }
  const query = executor
    .select()
    .from(documentTemplate)
    .where(eq(documentTemplate.id, templateId))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ? toTemplate(row) : null;
}

export function createDatabaseDocumentTemplates(
  database: Database,
): DocumentTemplateAccess {
  return {
    get: (accountId, templateId) =>
      findOwnedDocumentTemplate(database, accountId, templateId, false),
    async list(accountId, projectId) {
      const scope = await ownedScope(database, accountId, projectId, false);
      if (!scope) {
        throw new DocumentUnavailableError();
      }
      const rows = await database
        .select()
        .from(documentTemplate)
        .where(
          scope.projectId
            ? eq(documentTemplate.projectId, scope.projectId)
            : and(
                isNull(documentTemplate.projectId),
                eq(documentTemplate.workspaceId, scope.workspaceId ?? ""),
              ),
        )
        .orderBy(desc(documentTemplate.updatedAt));
      return rows.map(toTemplate);
    },
  };
}

async function validateTemplateSource(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: {
    projectId: string | null;
    sourceDocumentId?: string;
    sourceRevision?: number;
  },
  lock: boolean,
) {
  if (!input.sourceDocumentId) {
    return true;
  }
  const source = await findOwnedDocument(
    executor,
    accountId,
    input.sourceDocumentId,
    lock,
  );
  if (!source || source.projectId !== input.projectId) {
    return false;
  }
  if (source.revision !== input.sourceRevision) {
    throw new MutationStaleBaseRevisionError({
      id: source.id,
      revision: source.revision,
      value: {
        document: documentSchema.parse({
          id: source.id,
          projectId: source.projectId,
          title: source.title,
          body: source.body,
          type: source.type,
          revision: source.revision,
          createdAt: source.createdAt.toISOString(),
          updatedAt: source.updatedAt.toISOString(),
        }),
      },
    });
  }
  return true;
}

function templateTarget(
  accountId: string,
  operation: "create" | "update",
): MutationDatabaseTargetAdapter<DocumentTemplateMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      const payload = context?.payload;
      if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload)
      ) {
        return null;
      }
      if (operation === "update") {
        const parsed = updateDocumentTemplateInputSchema.safeParse({
          ...payload,
          baseRevision: 1,
          clientIdempotencyKey: "validation",
        });
        if (!parsed.success || parsed.data.templateId !== targetId) {
          return null;
        }
        const template = await findOwnedDocumentTemplate(
          executor,
          accountId,
          targetId,
          lock,
        );
        return template
          ? { id: targetId, revision: template.revision, value: { template } }
          : null;
      }
      const parsed = createDocumentTemplateInputSchema.safeParse({
        ...payload,
        baseRevision: 0,
        clientIdempotencyKey: "validation",
      });
      if (
        !(
          parsed.success &&
          (await ownedScope(executor, accountId, parsed.data.projectId, lock))
        )
      ) {
        return null;
      }
      if (
        !(await validateTemplateSource(executor, accountId, parsed.data, lock))
      ) {
        return null;
      }
      return { id: targetId, revision: 0, value: { template: null } };
    },
    async update(executor, input) {
      const { template } = input.nextValue;
      if (!template) {
        return null;
      }
      if (operation === "create") {
        if (input.expectedRevision !== 0) {
          return null;
        }
        const scope = await ownedScope(
          executor,
          accountId,
          template.projectId,
          false,
        );
        if (!scope) {
          return null;
        }
        const [row] = await executor
          .insert(documentTemplate)
          .values({
            ...scope,
            id: template.id,
            body: template.body,
            name: template.name,
            type: template.type,
            revision: 1,
            createdAt: input.committedAt,
            updatedAt: input.committedAt,
          })
          .returning();
        return row
          ? {
              id: input.targetId,
              revision: 1,
              value: { template: toTemplate(row) },
            }
          : null;
      }
      if (template.id !== input.targetId) {
        return null;
      }
      const [row] = await executor
        .update(documentTemplate)
        .set({
          body: template.body,
          name: template.name,
          type: template.type,
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(documentTemplate.id, input.targetId),
            eq(documentTemplate.revision, input.expectedRevision),
          ),
        )
        .returning();
      return row
        ? {
            id: input.targetId,
            revision: row.revision,
            value: { template: toTemplate(row) },
          }
        : null;
    },
  };
}

export function createDatabaseDocumentTemplateMutationContracts(
  database: Database,
): DocumentTemplateMutationContracts {
  return {
    create: (accountId) =>
      createDatabaseMutationContract(database, {
        target: templateTarget(accountId, "create"),
      }),
    update: (accountId) =>
      createDatabaseMutationContract(database, {
        target: templateTarget(accountId, "update"),
      }),
  };
}
