import {
  documentTemplateInstantiationSchema,
  personalReviewTemplate,
} from "@cantiara/api/document-templates";
import type {
  CreateDocumentInput,
  Document,
  DocumentConflictDraft,
  DocumentInlineTag,
  DocumentMutationContracts,
  DocumentMutationValue,
  DocumentsAccess,
  DocumentVersionSummary,
} from "@cantiara/api/documents";
import {
  createDocumentInputSchema,
  DocumentConflictDraftError,
  DocumentHierarchyError,
  DocumentUnavailableError,
  documentConflictDraftSchema,
  documentCreationInputSchema,
  documentLiveDirectives,
  documentOrganizationInputSchema,
  documentRecordReferences,
  documentSchema,
  documentSectionById,
  documentVersionSummarySchema,
  previewDocumentHierarchy,
  resolveDocumentInlineTags,
  updateDocumentInputSchema,
} from "@cantiara/api/documents";
import {
  fingerprintMutationPayload,
  type MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  resolveProjectShellConfiguration,
  starterConfigurationSchema,
} from "@cantiara/api/project-shell";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document, documentConflictDraft } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import { usageLink } from "@cantiara/db/schema/relation";
import { workspaceTag } from "@cantiara/db/schema/tags";
import { work } from "@cantiara/db/schema/work";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { MutationStaleBaseRevisionError } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { createDatabaseDocumentDiscovery } from "../../record-discovery/server/document-discovery-database";
import { assertDocumentSectionAcyclic } from "./document-live-section-database";
import {
  findOwnedDocument,
  findOwnedProject,
  findWorkspaceId,
} from "./document-ownership-database";
import { toDocument } from "./document-row";
import {
  createDatabaseDocumentTemplateMutationContracts,
  createDatabaseDocumentTemplates,
  findOwnedDocumentTemplate,
} from "./document-templates-database";
import {
  createDatabaseDocumentTransferContract,
  previewDatabaseDocumentTransfer,
} from "./document-transfer-database";

function toDocumentVersionSummary(value: Document): DocumentVersionSummary {
  return documentVersionSummarySchema.parse({
    id: value.id,
    revision: value.revision,
    title: value.title,
    type: value.type,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

function documentVersionSummaryProjection(
  value:
    | typeof mutationHistory.previousValue
    | typeof mutationHistory.nextValue,
) {
  const snapshot = sql`${value}->'document'`;
  return sql<unknown>`CASE
    WHEN ${snapshot}->>'id' IS NOT NULL THEN jsonb_build_object(
      'id', ${snapshot}->'id',
      'revision', ${snapshot}->'revision',
      'title', ${snapshot}->'title',
      'type', ${snapshot}->'type',
      'createdAt', ${snapshot}->'createdAt',
      'updatedAt', ${snapshot}->'updatedAt'
    )
  END`;
}

function toTarget(
  record: typeof document.$inferSelect,
): MutationTarget<DocumentMutationValue> {
  const value = toDocument(record);
  return {
    id: value.id,
    revision: value.revision,
    value: { document: value },
  };
}

function emptyTarget(targetId: string): MutationTarget<DocumentMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { document: null },
  };
}

function toConflictDraft(
  row: typeof documentConflictDraft.$inferSelect,
): DocumentConflictDraft {
  return documentConflictDraftSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
  });
}

type ConflictDraftScope =
  | { projectId: string; workspaceId: null }
  | { projectId: null; workspaceId: string };

function conflictDraftScopeCondition(scope: ConflictDraftScope) {
  return scope.projectId === null
    ? and(
        isNull(documentConflictDraft.projectId),
        eq(documentConflictDraft.workspaceId, scope.workspaceId),
      )
    : and(
        eq(documentConflictDraft.projectId, scope.projectId),
        isNull(documentConflictDraft.workspaceId),
      );
}

function conflictDraftScopeFromRecord(record: {
  projectId: string | null;
  workspaceId: string | null;
}): ConflictDraftScope | null {
  if (record.projectId !== null) {
    return { projectId: record.projectId, workspaceId: null };
  }
  if (record.workspaceId !== null) {
    return { projectId: null, workspaceId: record.workspaceId };
  }
  return null;
}

async function conflictDraftScopeFromProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string | null,
): Promise<ConflictDraftScope | null> {
  if (projectId !== null) {
    return { projectId, workspaceId: null };
  }
  const workspaceId = await findWorkspaceId(executor, accountId);
  return workspaceId ? { projectId: null, workspaceId } : null;
}

async function requireConflictDraft(
  executor: MutationDatabaseExecutor,
  draftId: string,
  scope: ConflictDraftScope,
  documentId?: string,
) {
  const [draft] = await executor
    .select()
    .from(documentConflictDraft)
    .where(
      and(
        eq(documentConflictDraft.id, draftId),
        conflictDraftScopeCondition(scope),
        isNull(documentConflictDraft.resolvedAt),
        ...(documentId
          ? [eq(documentConflictDraft.documentId, documentId)]
          : []),
      ),
    )
    .limit(1)
    .for("update");
  if (!draft) {
    throw new DocumentConflictDraftError();
  }
  return draft;
}

async function resolveConflictDraft(
  executor: MutationDatabaseExecutor,
  draftId: string,
  committedAt: Date,
) {
  await executor
    .update(documentConflictDraft)
    .set({ resolvedAt: committedAt })
    .where(eq(documentConflictDraft.id, draftId));
}

async function resolveWorkspaceTags(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  return workspaceId
    ? await executor
        .select({ id: workspaceTag.id, name: workspaceTag.name })
        .from(workspaceTag)
        .where(eq(workspaceTag.workspaceId, workspaceId))
    : [];
}

async function resolveInlineTags(
  executor: MutationDatabaseExecutor,
  accountId: string,
  body: string,
  existingBindings: readonly DocumentInlineTag[] = [],
) {
  return resolveDocumentInlineTags(
    body,
    await resolveWorkspaceTags(executor, accountId),
    existingBindings,
  );
}

function documentScopeFilter(
  projectId: string | null,
  workspaceId: string | null,
) {
  if (projectId !== null) {
    return eq(document.projectId, projectId);
  }
  if (workspaceId === null) {
    throw new DocumentUnavailableError();
  }
  return and(isNull(document.projectId), eq(document.workspaceId, workspaceId));
}

async function documentsInScope(
  executor: MutationDatabaseExecutor,
  projectId: string | null,
  workspaceId: string | null,
) {
  const rows = await executor
    .select()
    .from(document)
    .where(documentScopeFilter(projectId, workspaceId))
    .orderBy(asc(document.id));
  return rows.map(toDocument);
}

type DocumentLiveDirective = ReturnType<typeof documentLiveDirectives>[number];
type DocumentLiveUsageKind = "Live block" | "Section reference";

function liveUsageKind(
  directive: DocumentLiveDirective,
): DocumentLiveUsageKind {
  return directive.kind === "Document section"
    ? "Section reference"
    : "Live block";
}

function liveUsageSourceType(directive: DocumentLiveDirective) {
  if (directive.kind === "Document section") {
    return "Document";
  }
  if (directive.kind === "Smart Collection") {
    return "Smart Collection View";
  }
  return directive.kind;
}

function liveUsageLocation(
  kind: DocumentLiveUsageKind,
  ordinal: number,
  sectionId?: string,
  viewId?: string,
) {
  const location: Record<string, unknown> = {};
  if (kind === "Live block") {
    location.documentLiveOrdinal = ordinal;
  } else {
    location.documentSectionOrdinal = ordinal;
    if (sectionId) {
      location.sectionId = sectionId;
    }
  }
  if (viewId) {
    location.viewId = viewId;
  }
  return location;
}

async function syncDocumentLiveUsageLinks(
  executor: MutationDatabaseExecutor,
  accountId: string,
  documentId: string,
  body: string,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    throw new DocumentUnavailableError();
  }
  const existing = await executor
    .select({
      id: usageLink.id,
      kind: usageLink.kind,
      location: usageLink.location,
      sourceRecordId: usageLink.sourceRecordId,
      sourceRecordType: usageLink.sourceRecordType,
    })
    .from(usageLink)
    .where(
      and(
        eq(usageLink.workspaceId, workspaceId),
        eq(usageLink.surfaceRecordType, "Document"),
        eq(usageLink.surfaceRecordId, documentId),
        inArray(usageLink.kind, ["Live block", "Section reference"]),
      ),
    );
  const available = existing.filter(
    ({ location }) =>
      !!location &&
      typeof location === "object" &&
      ("documentLiveWorkOrdinal" in location ||
        "documentLiveOrdinal" in location ||
        "documentSectionOrdinal" in location),
  );
  const directives = documentLiveDirectives(body);
  const newLinks: (typeof usageLink.$inferInsert)[] = [];
  const locationUpdates: {
    id: string;
    kind: "Live block" | "Section reference";
    ordinal: number;
    sectionId?: string;
    viewId?: string;
  }[] = [];
  let sectionOrdinal = 0;
  for (const [index, directive] of directives.entries()) {
    const kind = liveUsageKind(directive);
    const ordinal = kind === "Section reference" ? sectionOrdinal : index;
    if (kind === "Section reference") {
      sectionOrdinal += 1;
    }
    const sourceRecordType = liveUsageSourceType(directive);
    const previousIndex = available.findIndex(
      (candidate) =>
        candidate.kind === kind &&
        candidate.sourceRecordId === directive.id &&
        candidate.sourceRecordType === sourceRecordType,
    );
    if (previousIndex !== -1) {
      const [previous] = available.splice(previousIndex, 1);
      if (previous) {
        locationUpdates.push({
          id: previous.id,
          kind,
          ordinal,
          sectionId: directive.sectionId,
          viewId: directive.viewId,
        });
      }
      continue;
    }
    newLinks.push({
      id: crypto.randomUUID(),
      kind,
      location: liveUsageLocation(
        kind,
        ordinal,
        directive.sectionId,
        directive.viewId,
      ),
      revision: 1,
      sourceRecordId: directive.id,
      sourceRecordType,
      surfaceRecordId: documentId,
      surfaceRecordType: "Document",
      workspaceId,
    });
  }
  if (available.length > 0) {
    await executor.delete(usageLink).where(
      inArray(
        usageLink.id,
        available.map(({ id }) => id),
      ),
    );
  }
  await Promise.all(
    locationUpdates.map(({ id, kind, ordinal, sectionId, viewId }) =>
      executor
        .update(usageLink)
        .set({ location: liveUsageLocation(kind, ordinal, sectionId, viewId) })
        .where(eq(usageLink.id, id)),
    ),
  );
  if (newLinks.length > 0) {
    await executor.insert(usageLink).values(newLinks);
  }
}

async function syncDocumentInlineUsageLinks(
  executor: MutationDatabaseExecutor,
  accountId: string,
  documentId: string,
  body: string,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    throw new DocumentUnavailableError();
  }
  const existing = await executor
    .select({
      id: usageLink.id,
      sourceRecordId: usageLink.sourceRecordId,
      sourceRecordType: usageLink.sourceRecordType,
    })
    .from(usageLink)
    .where(
      and(
        eq(usageLink.workspaceId, workspaceId),
        eq(usageLink.surfaceRecordType, "Document"),
        eq(usageLink.surfaceRecordId, documentId),
        eq(usageLink.kind, "Inline reference"),
      ),
    );
  const available = [...existing];
  const additions: (typeof usageLink.$inferInsert)[] = [];
  const updates: Array<{ id: string; location: Record<string, unknown> }> = [];
  for (const [ordinal, reference] of documentRecordReferences(body).entries()) {
    const previousIndex = available.findIndex(
      (candidate) =>
        candidate.sourceRecordId === reference.recordId &&
        candidate.sourceRecordType === reference.recordType,
    );
    const location = {
      documentReferenceOrdinal: ordinal,
      end: reference.end,
      label: reference.label,
      start: reference.start,
    };
    if (previousIndex !== -1) {
      const [previous] = available.splice(previousIndex, 1);
      if (previous) {
        updates.push({ id: previous.id, location });
      }
      continue;
    }
    additions.push({
      id: crypto.randomUUID(),
      kind: "Inline reference",
      location,
      revision: 1,
      sourceRecordId: reference.recordId,
      sourceRecordType: reference.recordType,
      surfaceRecordId: documentId,
      surfaceRecordType: "Document",
      workspaceId,
    });
  }
  if (available.length > 0) {
    await executor.delete(usageLink).where(
      inArray(
        usageLink.id,
        available.map(({ id }) => id),
      ),
    );
  }
  await Promise.all(
    updates.map(({ id, location }) =>
      executor.update(usageLink).set({ location }).where(eq(usageLink.id, id)),
    ),
  );
  if (additions.length > 0) {
    await executor.insert(usageLink).values(additions);
  }
}

async function validateDocumentTemplateInstantiation(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: ReturnType<typeof documentTemplateInstantiationSchema.parse>,
  targetId: string,
  lock: boolean,
) {
  if (input.templateId === personalReviewTemplate.id) {
    return true;
  }
  const template = await findOwnedDocumentTemplate(
    executor,
    accountId,
    input.templateId,
    lock,
  );
  if (!template || template.projectId !== input.projectId) {
    return false;
  }
  if (template.revision !== input.templateRevision) {
    throw new MutationStaleBaseRevisionError({
      id: targetId,
      revision: template.revision,
      value: { document: null },
    });
  }
  return true;
}

async function resolveCreationScope(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string | null,
  lock: boolean,
): Promise<{
  project: typeof project.$inferSelect | null;
  scopeOwned: boolean;
}> {
  if (projectId === null) {
    return {
      project: null,
      scopeOwned: (await findWorkspaceId(executor, accountId)) !== null,
    };
  }
  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    projectId,
    lock,
  );
  return {
    project: ownedProject,
    scopeOwned: ownedProject !== null && ownedProject.archivedAt === null,
  };
}

function allowedDocumentSkeleton(
  ownedProject: typeof project.$inferSelect,
  payload:
    | CreateDocumentInput
    | ReturnType<typeof documentTemplateInstantiationSchema.parse>
    | ReturnType<typeof documentCreationInputSchema.parse>,
) {
  if (!("skeleton" in payload)) {
    return true;
  }
  const configuration = resolveProjectShellConfiguration(
    ownedProject.configuration,
    starterConfigurationSchema.parse(ownedProject.starterConfiguration),
  );
  return configuration.starterSkeletons.some(
    (selection) =>
      selection.surface === "Document" &&
      selection.skeleton === payload.skeleton,
  );
}

function createDocumentTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<DocumentMutationValue> {
  return {
    committedValue: (target) => target.value,
    async find(executor, targetId, lock, context) {
      const templatePayload = documentTemplateInstantiationSchema.safeParse(
        context?.payload,
      );
      let payloadData:
        | ReturnType<typeof documentTemplateInstantiationSchema.parse>
        | CreateDocumentInput
        | ReturnType<typeof documentCreationInputSchema.parse>
        | null = null;
      if (templatePayload.success) {
        payloadData = templatePayload.data;
      } else {
        const creationPayload = documentCreationInputSchema.safeParse(
          context?.payload,
        );
        if (creationPayload.success) {
          payloadData = creationPayload.data;
        }
      }
      if (!payloadData) {
        return null;
      }
      const owned = await resolveCreationScope(
        executor,
        accountId,
        payloadData.projectId,
        lock,
      );
      if (!owned.scopeOwned) {
        return null;
      }
      if (
        templatePayload.success &&
        !(await validateDocumentTemplateInstantiation(
          executor,
          accountId,
          templatePayload.data,
          targetId,
          lock,
        ))
      ) {
        return null;
      }
      if (
        owned.project &&
        !allowedDocumentSkeleton(owned.project, payloadData)
      ) {
        return null;
      }
      return emptyTarget(targetId);
    },

    async update(executor, input) {
      const nextDocument = input.nextValue.document;
      if (!nextDocument || input.expectedRevision !== 0) {
        return null;
      }
      const payload: CreateDocumentInput = {
        body: nextDocument.body,
        projectId: nextDocument.projectId,
        title: nextDocument.title,
        type: nextDocument.type,
      };
      if (!createDocumentInputSchema.safeParse(payload).success) {
        return null;
      }
      await assertDocumentSectionAcyclic(
        executor,
        accountId,
        nextDocument.id,
        nextDocument.body,
      );
      const conflictDraftId = input.nextValue.conflictDraftId ?? null;
      const scope = await conflictDraftScopeFromProject(
        executor,
        accountId,
        nextDocument.projectId,
      );
      const draft =
        conflictDraftId && scope
          ? await requireConflictDraft(executor, conflictDraftId, scope)
          : null;
      const [created] = await executor
        .insert(document)
        .values({
          inlineTags: await resolveInlineTags(
            executor,
            accountId,
            nextDocument.body,
          ),
          body: nextDocument.body,
          createdAt: input.committedAt,
          id: nextDocument.id,
          projectId: nextDocument.projectId,
          workspaceId:
            nextDocument.projectId === null
              ? await findWorkspaceId(executor, accountId)
              : null,
          revision: 1,
          title: nextDocument.title,
          type: nextDocument.type,
          updatedAt: input.committedAt,
          originDocumentId: draft?.documentId,
          originRevision: draft?.baseRevision,
          originConflictDraftId: draft?.id,
        })
        .returning();
      if (created) {
        if (conflictDraftId) {
          await resolveConflictDraft(
            executor,
            conflictDraftId,
            input.committedAt,
          );
        }
        await syncDocumentLiveUsageLinks(
          executor,
          accountId,
          created.id,
          created.body,
        );
        await syncDocumentInlineUsageLinks(
          executor,
          accountId,
          created.id,
          created.body,
        );
      }
      return created
        ? {
            id: input.targetId,
            revision: created.revision,
            value: { document: toDocument(created) },
          }
        : null;
    },
  };
}

function updateDocumentTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<DocumentMutationValue> {
  return {
    committedValue: (target) => target.value,
    async find(executor, targetId, lock, context) {
      const payload = updateDocumentInputSchema.safeParse(context?.payload);
      if (!(payload.success && payload.data.documentId === targetId)) {
        return null;
      }
      const record = await findOwnedDocument(
        executor,
        accountId,
        targetId,
        lock,
      );
      if (record && payload.data.conflictDraftId) {
        const scope = conflictDraftScopeFromRecord(record);
        if (!scope) {
          return null;
        }
        await requireConflictDraft(
          executor,
          payload.data.conflictDraftId,
          scope,
          record.id,
        );
      }
      return record ? toTarget(record) : null;
    },

    async update(executor, input) {
      const nextDocument = input.nextValue.document;
      if (!nextDocument || nextDocument.id !== input.targetId) {
        return null;
      }
      await assertDocumentSectionAcyclic(
        executor,
        accountId,
        nextDocument.id,
        nextDocument.body,
      );
      const [updated] = await executor
        .update(document)
        .set({
          inlineTags: await resolveInlineTags(
            executor,
            accountId,
            nextDocument.body,
            nextDocument.inlineTags,
          ),
          body: nextDocument.body,
          revision: input.expectedRevision + 1,
          title: nextDocument.title,
          type: nextDocument.type,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(document.id, input.targetId),
            eq(document.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        const { conflictDraftId } = input.nextValue;
        if (conflictDraftId) {
          await resolveConflictDraft(
            executor,
            conflictDraftId,
            input.committedAt,
          );
        }
        await syncDocumentLiveUsageLinks(
          executor,
          accountId,
          updated.id,
          updated.body,
        );
        await syncDocumentInlineUsageLinks(
          executor,
          accountId,
          updated.id,
          updated.body,
        );
      }
      return updated ? toTarget(updated) : null;
    },
  };
}

export function createDatabaseDocuments(database: Database): DocumentsAccess {
  async function get(accountId: string, documentId: string) {
    const [row] = await database
      .select({ document })
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
          eq(document.id, documentId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      ...toDocument(row.document),
      inlineTags: await resolveInlineTags(
        database,
        accountId,
        row.document.body,
        row.document.inlineTags,
      ),
    };
  }

  async function getLiveSection(
    accountId: string,
    documentId: string,
    sectionId: string,
  ) {
    const source = await get(accountId, documentId);
    const section = source ? documentSectionById(source.body, sectionId) : null;
    return source && section
      ? {
          documentId: source.id,
          heading: section.heading,
          projectId: source.projectId,
          sectionId,
          title: source.title,
          text: section.content,
        }
      : null;
  }

  return {
    templates: createDatabaseDocumentTemplates(database),
    discovery: createDatabaseDocumentDiscovery(database, toDocument),
    get,
    getLiveSection,
    async captureConflictDraft(accountId, input) {
      const payloadFingerprint = await fingerprintMutationPayload(input);
      const base = await this.getVersion(
        accountId,
        input.documentId,
        input.baseRevision,
      );
      if (!base) {
        throw new DocumentUnavailableError();
      }
      return database.transaction(async (executor) => {
        const current = await findOwnedDocument(
          executor,
          accountId,
          input.documentId,
          true,
        );
        if (!current) {
          throw new DocumentUnavailableError();
        }
        const scope = conflictDraftScopeFromRecord(current);
        if (!scope) {
          throw new DocumentUnavailableError();
        }
        const [existing] = await executor
          .select()
          .from(documentConflictDraft)
          .where(
            and(
              eq(documentConflictDraft.documentId, input.documentId),
              eq(
                documentConflictDraft.clientIdempotencyKey,
                input.clientIdempotencyKey,
              ),
            ),
          )
          .limit(1);
        if (existing) {
          if (existing.payloadFingerprint !== payloadFingerprint) {
            throw new DocumentConflictDraftError();
          }
          return toConflictDraft(existing);
        }
        const [draft] = await executor
          .insert(documentConflictDraft)
          .values({
            id: crypto.randomUUID(),
            documentId: current.id,
            projectId: current.projectId,
            workspaceId: current.workspaceId,
            baseRevision: input.baseRevision,
            title: input.title ?? base.title,
            body: input.body ?? base.body,
            type: input.type ?? base.type,
            clientIdempotencyKey: input.clientIdempotencyKey,
            payloadFingerprint,
          })
          .returning();
        if (!draft) {
          throw new DocumentUnavailableError();
        }
        return toConflictDraft(draft);
      });
    },
    async conflictDrafts(accountId, documentId) {
      if (!(await get(accountId, documentId))) {
        return null;
      }
      const drafts = await database
        .select()
        .from(documentConflictDraft)
        .where(
          and(
            eq(documentConflictDraft.documentId, documentId),
            isNull(documentConflictDraft.resolvedAt),
          ),
        )
        .orderBy(asc(documentConflictDraft.createdAt));
      return drafts.map(toConflictDraft);
    },
    async discardConflictDraft(accountId, documentId, conflictDraftId) {
      await database.transaction(async (executor) => {
        const current = await findOwnedDocument(
          executor,
          accountId,
          documentId,
          true,
        );
        if (!current) {
          throw new DocumentUnavailableError();
        }
        const scope = conflictDraftScopeFromRecord(current);
        if (!scope) {
          throw new DocumentUnavailableError();
        }
        const [draft] = await executor
          .select()
          .from(documentConflictDraft)
          .where(
            and(
              eq(documentConflictDraft.id, conflictDraftId),
              eq(documentConflictDraft.documentId, documentId),
              conflictDraftScopeCondition(scope),
            ),
          )
          .limit(1)
          .for("update");
        if (!draft) {
          throw new DocumentConflictDraftError();
        }
        if (!draft.resolvedAt) {
          await resolveConflictDraft(executor, draft.id, new Date());
        }
      });
    },
    async getLiveWork(accountId, workId) {
      const [source] = await database
        .select({
          id: work.id,
          key: work.key,
          plannedStartDate: work.plannedStartDate,
          projectId: work.projectId,
          status: work.status,
          targetDate: work.targetDate,
          title: work.title,
          type: work.type,
        })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(work.id, workId),
            eq(workspace.ownerAccountId, accountId),
            isNull(work.trashedAt),
          ),
        )
        .limit(1);
      if (!source) {
        return null;
      }
      const priorityRows = await database
        .select({
          name: priorityMetricDefinition.name,
          rank: workPriorityMetricValue.rank,
        })
        .from(workPriorityMetricValue)
        .innerJoin(
          priorityMetricDefinition,
          eq(workPriorityMetricValue.metricId, priorityMetricDefinition.id),
        )
        .where(
          and(
            eq(workPriorityMetricValue.workId, workId),
            eq(priorityMetricDefinition.enabled, true),
            isNull(priorityMetricDefinition.trashedAt),
            isNotNull(workPriorityMetricValue.rank),
          ),
        )
        .orderBy(asc(priorityMetricDefinition.createdAt));
      return {
        ...source,
        priority: priorityRows.flatMap(({ name, rank }) =>
          rank ? [{ name, rank }] : [],
        ),
      };
    },
    async getVersion(accountId, documentId, revision) {
      const current = await get(accountId, documentId);
      if (!current) {
        return null;
      }
      if (current.revision === revision) {
        return current;
      }
      if (revision < 1 || revision > current.revision) {
        return null;
      }

      const historyRevision = revision === 1 ? 2 : revision;
      const snapshot =
        revision === 1
          ? sql<unknown>`${mutationHistory.previousValue}->'document'`
          : sql<unknown>`${mutationHistory.nextValue}->'document'`;
      const [entry] = await database
        .select({ snapshot })
        .from(mutationHistory)
        .where(
          and(
            eq(mutationHistory.targetId, documentId),
            eq(mutationHistory.revision, historyRevision),
          ),
        )
        .limit(1);
      const parsed = documentSchema.safeParse(entry?.snapshot);
      return parsed.success &&
        parsed.data.id === documentId &&
        parsed.data.revision === revision
        ? parsed.data
        : null;
    },
    async versions(accountId, documentId) {
      const current = await get(accountId, documentId);
      if (!current) {
        return null;
      }
      const history = await database
        .select({
          previousVersion: documentVersionSummaryProjection(
            mutationHistory.previousValue,
          ),
          nextVersion: documentVersionSummaryProjection(
            mutationHistory.nextValue,
          ),
        })
        .from(mutationHistory)
        .where(eq(mutationHistory.targetId, documentId))
        .orderBy(desc(mutationHistory.revision));
      const versions = new Map<number, DocumentVersionSummary>([
        [current.revision, toDocumentVersionSummary(current)],
      ]);
      for (const entry of history) {
        for (const value of [entry.nextVersion, entry.previousVersion]) {
          const parsed = documentVersionSummarySchema.safeParse(value);
          if (parsed.success && parsed.data.id === documentId) {
            versions.set(parsed.data.revision, parsed.data);
          }
        }
      }
      return [...versions.values()].sort((a, b) => b.revision - a.revision);
    },
    async previewOrganization(accountId, input) {
      const record = await findOwnedDocument(
        database,
        accountId,
        input.documentId,
        false,
      );
      if (!record) {
        throw new DocumentUnavailableError();
      }
      const documents = await documentsInScope(
        database,
        record.projectId,
        record.workspaceId,
      );
      const preview = previewDocumentHierarchy(
        documents,
        input.action === "hierarchy"
          ? input
          : {
              documentId: record.id,
              parentDocumentId: record.parentDocumentId,
              folder: record.folder,
            },
      );
      return {
        ...preview,
        descendants: documents
          .filter(({ id }) => preview.descendantIds.includes(id))
          .map(({ id, title, archivedAt }) => ({ id, title, archivedAt })),
      };
    },
    previewTransfer: (accountId, input) =>
      previewDatabaseDocumentTransfer(database, accountId, input),
    async list(accountId, projectId, archived = false) {
      const archiveFilter = archived
        ? isNotNull(document.archivedAt)
        : isNull(document.archivedAt);
      let rows: Array<{ document: typeof document.$inferSelect }>;
      if (projectId === null) {
        const workspaceId = await findWorkspaceId(database, accountId);
        if (!workspaceId) {
          throw new DocumentUnavailableError();
        }
        rows = await database
          .select({ document })
          .from(document)
          .where(
            and(
              isNull(document.projectId),
              eq(document.workspaceId, workspaceId),
              archiveFilter,
            ),
          )
          .orderBy(desc(document.updatedAt));
      } else {
        const ownedProject = await findOwnedProject(
          database,
          accountId,
          projectId,
          false,
        );
        if (!ownedProject) {
          throw new DocumentUnavailableError();
        }
        rows = await database
          .select({ document })
          .from(document)
          .innerJoin(project, eq(document.projectId, project.id))
          .innerJoin(workspace, eq(project.workspaceId, workspace.id))
          .where(
            and(
              eq(document.projectId, projectId),
              eq(workspace.ownerAccountId, accountId),
              archiveFilter,
            ),
          )
          .orderBy(desc(document.updatedAt));
      }
      const tags = await resolveWorkspaceTags(database, accountId);
      return rows.map(({ document: row }) => ({
        ...toDocument(row),
        inlineTags: resolveDocumentInlineTags(row.body, tags, row.inlineTags),
      }));
    },
  };
}

export function createDatabaseDocumentMutationContracts(
  database: Database,
): DocumentMutationContracts {
  return {
    transfer: (accountId, input, previewFingerprint) =>
      createDatabaseDocumentTransferContract(
        database,
        accountId,
        input,
        previewFingerprint,
      ),
    organize: (accountId) =>
      createDatabaseMutationContract<DocumentMutationValue>(database, {
        target: {
          committedValue: (target) => target.value,
          async find(executor, targetId, lock, context) {
            const payload = documentOrganizationInputSchema.safeParse(
              context?.payload,
            );
            if (!payload.success || payload.data.documentId !== targetId) {
              return null;
            }
            const record = await findOwnedDocument(
              executor,
              accountId,
              targetId,
              lock,
            );
            return record ? toTarget(record) : null;
          },
          async update(executor, input) {
            const next = input.nextValue.document;
            const current = await findOwnedDocument(
              executor,
              accountId,
              input.targetId,
              true,
            );
            if (
              !(next && current) ||
              current.revision !== input.expectedRevision ||
              next.id !== current.id ||
              next.projectId !== current.projectId
            ) {
              return null;
            }
            const preview = previewDocumentHierarchy(
              await documentsInScope(
                executor,
                current.projectId,
                current.workspaceId,
              ),
              {
                documentId: current.id,
                parentDocumentId: next.parentDocumentId ?? null,
                folder: next.folder ?? null,
              },
            );
            if (!preview.allowed) {
              throw new DocumentHierarchyError(
                preview.reason ?? "Document hierarchy is unavailable.",
              );
            }
            const [updated] = await executor
              .update(document)
              .set({
                archivedAt: next.archivedAt ? new Date(next.archivedAt) : null,
                folder: next.folder ?? null,
                parentDocumentId: next.parentDocumentId ?? null,
                revision: input.expectedRevision + 1,
                updatedAt: input.committedAt,
              })
              .where(
                and(
                  eq(document.id, current.id),
                  eq(document.revision, input.expectedRevision),
                ),
              )
              .returning();
            return updated ? toTarget(updated) : null;
          },
        },
      }),
    templates: createDatabaseDocumentTemplateMutationContracts(database),
    create: (accountId) =>
      createDatabaseMutationContract<DocumentMutationValue>(database, {
        target: createDocumentTarget(accountId),
      }),
    update: (accountId) =>
      createDatabaseMutationContract<DocumentMutationValue>(database, {
        target: updateDocumentTarget(accountId),
      }),
  };
}
