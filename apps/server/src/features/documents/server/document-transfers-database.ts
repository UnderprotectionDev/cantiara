// biome-ignore-all lint/performance/noAwaitInLoops: journal replay and transactional parent reattachment must preserve ordering.
import {
  DocumentTransferError,
  type DocumentTransferInput,
  type DocumentTransferPreview,
  type DocumentTransfersAccess,
  type DocumentTransferValue,
  documentTransferInputSchema,
  freezeDocumentLiveBlocks,
  selectDocumentMove,
} from "@cantiara/api/document-transfer";
import {
  type DocumentsAccess,
  DocumentUnavailableError,
  documentLiveDirectives,
  documentRecordReferences,
} from "@cantiara/api/documents";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { document, documentConflictDraft } from "@cantiara/db/schema/document";
import { externalSurface } from "@cantiara/db/schema/external-surface";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { createDatabaseProjectSourceRecords } from "../../project-source-records/server/project-source-records-database";
import { createDatabaseSmartCollections } from "../../smart-collections/server/smart-collections-database";
import { createDatabaseTechnicalDiagrams } from "../../technical-diagrams/server/technical-diagrams-database";
import {
  findOwnedDocument,
  findOwnedProject,
  findWorkspaceId,
} from "./document-ownership-database";
import { renderDocumentPdf } from "./document-pdf";
import type { DocumentSurfaceCancellations } from "./document-surface-cancellations";
import { toDocument } from "./documents-database";

export function createDatabaseDocumentTransfers(
  database: Database,
  access: DocumentsAccess,
  cancellations?: DocumentSurfaceCancellations,
): DocumentTransfersAccess {
  const collections = createDatabaseSmartCollections(database);
  const diagrams = createDatabaseTechnicalDiagrams(database);
  const sourceRecords = createDatabaseProjectSourceRecords(database);
  async function referenceExists(
    accountId: string,
    reference: ReturnType<typeof documentRecordReferences>[number],
  ) {
    switch (reference.recordType) {
      case "Document":
        return !!(await access.get(accountId, reference.recordId));
      case "Work":
        return !!(await access.getLiveWork(accountId, reference.recordId));
      case "Technical Diagram":
        return !!(await diagrams.get(accountId, reference.recordId));
      case "Decision":
      case "Risk":
      case "Assumption":
      case "Open Question":
      case "Milestone":
      case "Project Release":
      case "Production Incident":
        return !!(await sourceRecords.find(
          accountId,
          reference.recordType,
          reference.recordId,
        ));
      default:
        return false;
    }
  }
  async function liveSourceExists(
    accountId: string,
    directive: ReturnType<typeof documentLiveDirectives>[number],
  ) {
    switch (directive.kind) {
      case "Work":
        return !!(await access.getLiveWork(accountId, directive.id));
      case "Document section":
        return !!(await access.getLiveSection?.(
          accountId,
          directive.id,
          directive.sectionId ?? "",
        ));
      case "Smart Collection":
        return !!(await collections.getView(accountId, directive.id));
      default:
        return !!(await diagrams.get(
          accountId,
          directive.id,
          directive.viewId,
        ));
    }
  }
  async function replayCancellations() {
    if (!cancellations) {
      return;
    }
    for (const event of await cancellations.list()) {
      await database
        .update(externalSurface)
        .set({ cancelledAt: event.occurredAt })
        .where(
          and(
            eq(externalSurface.id, event.surfaceId),
            isNull(externalSurface.cancelledAt),
          ),
        );
    }
  }
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one locked selection validates ownership, graph and publication effects together.
  async function inspect(
    executor: MutationDatabaseExecutor,
    accountId: string,
    input: DocumentTransferInput,
    lock: boolean,
  ) {
    const workspaceId = await findWorkspaceId(executor, accountId, lock);
    const root = await findOwnedDocument(
      executor,
      accountId,
      input.documentId,
      lock,
    );
    if (!(workspaceId && root)) {
      throw new DocumentUnavailableError();
    }
    const target = input.targetProjectId
      ? await findOwnedProject(executor, accountId, input.targetProjectId, lock)
      : null;
    if (
      input.targetProjectId &&
      (target?.status !== "Active" || target.archivedAt)
    ) {
      throw new DocumentUnavailableError();
    }
    const scope = root.projectId
      ? eq(document.projectId, root.projectId)
      : eq(document.workspaceId, workspaceId);
    const query = executor
      .select()
      .from(document)
      .where(scope)
      .orderBy(asc(document.id));
    const records = lock ? await query.for("update") : await query;
    const selectedIds =
      input.action === "Copy"
        ? [root.id]
        : selectDocumentMove(records, root.id, input.childDocumentIds);
    const selected = records.filter((record) =>
      selectedIds.includes(record.id),
    );
    const copySource =
      input.action === "Copy"
        ? await access.getVersion(accountId, root.id, input.sourceRevision)
        : null;
    if (input.action === "Copy" && !copySource) {
      throw new DocumentUnavailableError();
    }
    const previewDocuments = copySource ? [copySource] : selected;
    const attachments = await executor
      .select()
      .from(fileAttachment)
      .where(
        and(
          eq(fileAttachment.workspaceId, workspaceId),
          inArray(fileAttachment.ownerDocumentId, selectedIds),
          root.projectId
            ? eq(fileAttachment.projectId, root.projectId)
            : and(
                isNull(fileAttachment.projectId),
                eq(fileAttachment.personalWikiId, accountId),
              ),
        ),
      )
      .orderBy(asc(fileAttachment.id));
    const surfaces = await executor
      .select()
      .from(externalSurface)
      .where(
        and(
          eq(externalSurface.workspaceId, workspaceId),
          inArray(externalSurface.documentId, selectedIds),
          isNull(externalSurface.cancelledAt),
        ),
      )
      .orderBy(asc(externalSurface.id));
    const referenceChecks = await Promise.all(
      previewDocuments
        .flatMap((record) => documentRecordReferences(record.body))
        .map(async (reference) => ({
          reference,
          broken: !(await referenceExists(accountId, reference)),
        })),
    );
    const brokenReferences = referenceChecks
      .filter((item) => item.broken)
      .map((item) => item.reference);
    const liveChecks = await Promise.all(
      previewDocuments
        .flatMap((record) => documentLiveDirectives(record.body))
        .map(async (directive) => ({
          directive,
          broken: !(await liveSourceExists(accountId, directive)),
        })),
    );
    let reason: string | null = null;
    const assignmentAttachments =
      input.action === "Assign File Attachments"
        ? await executor
            .select()
            .from(fileAttachment)
            .where(
              and(
                eq(fileAttachment.workspaceId, workspaceId),
                inArray(fileAttachment.id, input.attachmentIds ?? []),
                root.projectId
                  ? eq(fileAttachment.projectId, root.projectId)
                  : and(
                      isNull(fileAttachment.projectId),
                      eq(fileAttachment.personalWikiId, accountId),
                    ),
              ),
            )
            .orderBy(asc(fileAttachment.id))
        : [];
    if (
      input.action === "Assign File Attachments" &&
      (assignmentAttachments.length !== input.attachmentIds?.length ||
        assignmentAttachments.some(
          (item) => item.ownerDocumentId && item.ownerDocumentId !== root.id,
        ))
    ) {
      throw new DocumentUnavailableError();
    }
    if (input.action === "Move") {
      const sourceProject = root.projectId
        ? await findOwnedProject(executor, accountId, root.projectId, lock)
        : null;
      if (sourceProject?.status !== "Active") {
        reason = "Move is available only from an Active Project.";
      } else if (input.targetProjectId === root.projectId) {
        reason = "Select a different target scope.";
      } else if (surfaces.length) {
        reason = "Cancel External Surface before Move.";
      }
    }
    const fingerprint = await fingerprintMutationPayload({
      input,
      records: records.map((record) => ({
        id: record.id,
        revision: record.revision,
        parentDocumentId: record.parentDocumentId,
      })),
      attachments: [...attachments, ...assignmentAttachments].map(
        ({
          id,
          revision,
          currentVersion,
          lifecycleStatus,
          ownerDocumentId,
        }) => ({
          id,
          revision,
          currentVersion,
          lifecycleStatus,
          ownerDocumentId,
        }),
      ),
      surfaces: surfaces.map(({ id }) => id),
    });
    const preview: DocumentTransferPreview = {
      fingerprint,
      documents: previewDocuments.map(({ id, title, revision }) => ({
        id,
        title,
        revision,
      })),
      attachments: (input.action === "Move"
        ? attachments
        : assignmentAttachments
      ).map(({ id, name, revision }) => ({ id, name, revision })),
      externalSurfaceIds: surfaces.map(({ id }) => id),
      brokenReferences: [
        ...brokenReferences.map((reference) => ({
          recordId: reference.recordId,
          label: reference.label,
        })),
        ...liveChecks
          .filter((item) => item.broken)
          .map(({ directive }) => ({
            recordId: directive.id,
            label: `${directive.kind}: ${directive.id}`,
          })),
      ],
      targetLabel: target?.name ?? "Personal Wiki",
      allowed: reason === null,
      reason,
    };
    return {
      root,
      workspaceId,
      records,
      selected,
      selectedIds,
      attachments,
      surfaces,
      preview,
    };
  }

  return {
    replayCancellations,
    preview: async (accountId, input) =>
      (
        await database.transaction((transaction) =>
          inspect(
            transaction,
            accountId,
            documentTransferInputSchema.parse(input),
            true,
          ),
        )
      ).preview,
    mutation: (accountId) =>
      createDatabaseMutationContract<DocumentTransferValue>(database, {
        target: {
          committedValue: (target) => ({ document: target.value.document }),
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: idempotent identity lookup distinguishes new copies from identity-preserving commands.
          async find(executor, targetId, lock, context) {
            const parsed = documentTransferInputSchema.safeParse(
              context?.payload
                ? Object.fromEntries(
                    Object.entries(context.payload).filter(
                      ([key]) => key !== "previewFingerprint",
                    ),
                  )
                : null,
            );
            if (!parsed.success) {
              return null;
            }
            const command = parsed.data;
            if (
              targetId !==
              (command.action === "Copy"
                ? command.newDocumentId
                : command.documentId)
            ) {
              return null;
            }
            const source = await findOwnedDocument(
              executor,
              accountId,
              command.documentId,
              lock,
            );
            if (!source) {
              return null;
            }
            if (command.action === "Copy") {
              const existing = await findOwnedDocument(
                executor,
                accountId,
                targetId,
                lock,
              );
              return {
                id: targetId,
                revision: existing?.revision ?? 0,
                value: { document: existing ? toDocument(existing) : null },
              };
            }
            return {
              id: targetId,
              revision: source.revision,
              value: { document: toDocument(source) },
            };
          },
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: all transfer effects must remain inside this atomic mutation adapter.
          async update(executor, input) {
            const { command } = input.nextValue;
            if (!command) {
              return null;
            }
            const { previewFingerprint, ...selection } = command;
            const state = await inspect(executor, accountId, selection, true);
            if (
              !state.preview.allowed ||
              state.preview.fingerprint !== previewFingerprint
            ) {
              throw new DocumentTransferError(
                state.preview.reason ??
                  "Document selection changed. Preview again.",
              );
            }
            if (command.action === "Copy") {
              const source = await access.getVersion(
                accountId,
                state.root.id,
                command.sourceRevision,
              );
              if (
                !(source && command.newDocumentId) ||
                input.expectedRevision !== 0
              ) {
                throw new DocumentUnavailableError();
              }
              const [created] = await executor
                .insert(document)
                .values({
                  id: command.newDocumentId,
                  projectId: command.targetProjectId,
                  workspaceId: command.targetProjectId
                    ? null
                    : state.workspaceId,
                  title: source.title,
                  body: source.body,
                  type: source.type,
                  inlineTags: source.inlineTags,
                  revision: 1,
                  originDocumentId: source.id,
                  originRevision: source.revision,
                  createdAt: input.committedAt,
                  updatedAt: input.committedAt,
                })
                .returning();
              return created
                ? {
                    id: created.id,
                    revision: 1,
                    value: { document: toDocument(created) },
                  }
                : null;
            }
            if (
              state.root.revision !== command.sourceRevision ||
              state.root.revision !== input.expectedRevision
            ) {
              throw new DocumentTransferError(
                "A newer Document version is available.",
              );
            }
            if (command.action === "Assign File Attachments") {
              await executor
                .update(fileAttachment)
                .set({
                  ownerDocumentId: state.root.id,
                  revision: sql`${fileAttachment.revision} + 1`,
                  updatedAt: input.committedAt,
                })
                .where(inArray(fileAttachment.id, command.attachmentIds ?? []));
              const [updated] = await executor
                .update(document)
                .set({
                  revision: input.expectedRevision + 1,
                  updatedAt: input.committedAt,
                })
                .where(eq(document.id, state.root.id))
                .returning();
              return updated
                ? {
                    id: updated.id,
                    revision: updated.revision,
                    value: { document: toDocument(updated) },
                  }
                : null;
            }
            if (command.action === "Cancel External Surface") {
              if (!cancellations) {
                throw new Error(
                  "External Surface cancellation journal is unavailable.",
                );
              }
              const actorAlias = await fingerprintMutationPayload({
                accountId,
              });
              for (const surface of state.surfaces) {
                await cancellations.append({
                  actorAlias,
                  surfaceId: surface.id,
                  occurredAt: input.committedAt,
                });
              }
              if (state.surfaces.length) {
                await executor
                  .update(externalSurface)
                  .set({ cancelledAt: input.committedAt })
                  .where(
                    inArray(
                      externalSurface.id,
                      state.surfaces.map(({ id }) => id),
                    ),
                  );
              }
              const [updated] = await executor
                .update(document)
                .set({
                  revision: input.expectedRevision + 1,
                  updatedAt: input.committedAt,
                })
                .where(eq(document.id, state.root.id))
                .returning();
              return updated
                ? {
                    id: updated.id,
                    revision: updated.revision,
                    value: { document: toDocument(updated) },
                  }
                : null;
            }
            const detached = state.records.filter(
              (record) =>
                !state.selectedIds.includes(record.id) &&
                record.parentDocumentId &&
                state.selectedIds.includes(record.parentDocumentId),
            );
            const changing = [...state.selected, ...detached];
            await executor
              .update(document)
              .set({ parentDocumentId: null })
              .where(
                inArray(
                  document.id,
                  changing.map(({ id }) => id),
                ),
              );
            const nextScope = {
              projectId: command.targetProjectId,
              workspaceId: command.targetProjectId ? null : state.workspaceId,
            };
            await executor
              .update(document)
              .set(nextScope)
              .where(inArray(document.id, state.selectedIds));
            for (const previous of changing) {
              const selected = state.selectedIds.includes(previous.id);
              const [updated] = await executor
                .update(document)
                .set({
                  parentDocumentId:
                    selected &&
                    previous.id !== state.root.id &&
                    previous.parentDocumentId &&
                    state.selectedIds.includes(previous.parentDocumentId)
                      ? previous.parentDocumentId
                      : null,
                  revision: previous.revision + 1,
                  updatedAt: input.committedAt,
                })
                .where(eq(document.id, previous.id))
                .returning();
              if (updated && previous.id !== state.root.id) {
                await executor.insert(mutationHistory).values({
                  id: crypto.randomUUID(),
                  targetId: previous.id,
                  revision: updated.revision,
                  actorType: "User",
                  actorId: accountId,
                  originKind: "human",
                  clientIdempotencyKey: input.idempotencyKey.key,
                  payloadFingerprint: input.payloadFingerprint,
                  previousValue: { document: toDocument(previous) },
                  nextValue: { document: toDocument(updated) },
                  occurredAt: input.committedAt,
                });
              }
            }
            await executor
              .update(documentConflictDraft)
              .set(nextScope)
              .where(
                inArray(documentConflictDraft.documentId, state.selectedIds),
              );
            if (state.attachments.length) {
              await executor
                .update(fileAttachment)
                .set({
                  projectId: command.targetProjectId,
                  personalWikiId: command.targetProjectId ? null : accountId,
                  scopeType: command.targetProjectId
                    ? "Project"
                    : "Personal Wiki",
                  updatedAt: input.committedAt,
                  revision: sql`${fileAttachment.revision} + 1`,
                })
                .where(
                  inArray(
                    fileAttachment.id,
                    state.attachments.map(({ id }) => id),
                  ),
                );
            }
            const [moved] = await executor
              .select()
              .from(document)
              .where(eq(document.id, state.root.id));
            return moved
              ? {
                  id: moved.id,
                  revision: moved.revision,
                  value: { document: toDocument(moved) },
                }
              : null;
          },
        },
      }),
    async snapshot(accountId, documentId, revision) {
      const source = await access.getVersion(accountId, documentId, revision);
      if (!source) {
        throw new DocumentUnavailableError();
      }
      const capturedAt = new Date().toISOString();
      const markdown = await freezeDocumentLiveBlocks(
        source.body,
        capturedAt,
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each supported live source uses its account-authorized counterpart.
        async (directive) => {
          if (directive.kind === "Work") {
            const record = await access.getLiveWork(accountId, directive.id);
            return record
              ? {
                  label: `${record.key} ${record.title}`,
                  text: `Type: ${record.type}\n\nStatus: ${record.status}\n\nPriority: ${record.priority.map((item) => `${item.name}: ${item.rank}`).join(", ")}\n\nPlanned start date: ${record.plannedStartDate ?? "—"}\n\nTarget date: ${record.targetDate ?? "—"}`,
                }
              : null;
          }
          if (directive.kind === "Document section") {
            const record = await access.getLiveSection?.(
              accountId,
              directive.id,
              directive.sectionId ?? "",
            );
            return record
              ? {
                  label: `${record.title} / ${record.heading}`,
                  text: record.text,
                }
              : null;
          }
          if (directive.kind === "Smart Collection") {
            const record = await collections.getView(accountId, directive.id);
            if (!record) {
              return null;
            }
            const text =
              record.presentation === "Table"
                ? [
                    "| Key | Title | Type | Status |",
                    "| --- | --- | --- | --- |",
                    ...record.works.map(
                      (item) =>
                        `| ${[item.key, item.title, item.type, item.status]
                          .map((value) =>
                            value
                              .replace(/\\/g, "\\\\")
                              .replace(/\|/g, "\\|")
                              .replace(/[\r\n]/g, " "),
                          )
                          .join(" | ")} |`,
                    ),
                  ].join("\n")
                : record.works
                    .map(
                      (item) =>
                        `- ${item.key} ${item.title} — ${item.type} — ${item.status}`,
                    )
                    .join("\n");
            return {
              label: `${record.collectionName} / ${record.name}`,
              text: text || "No Work.",
            };
          }
          const record = await diagrams.get(
            accountId,
            directive.id,
            directive.viewId,
          );
          if (!record) {
            return null;
          }
          const nodes = record.model.nodes.filter(
            (node) =>
              !record.view || record.view.selectedNodeIds.includes(node.id),
          );
          const labels = new Map(nodes.map((node) => [node.id, node.label]));
          const links = record.model.links
            .filter((link) => labels.has(link.from) && labels.has(link.to))
            .map(
              (link) =>
                `- ${labels.get(link.from)} → ${labels.get(link.to)}${link.label ? ` — ${link.label}` : ""}`,
            );
          return {
            label: `${record.title}${record.view ? ` / ${record.view.name}` : ""}`,
            text: [
              ...nodes.map((node) => `- ${node.label} (${node.kind})`),
              ...links,
            ].join("\n"),
          };
        },
      );
      return {
        documentId,
        revision: source.revision,
        title: source.title,
        capturedAt,
        markdown: `# ${source.title.replace(/[\r\n]/g, " ")}\n\n> Exported ${capturedAt} — Version ${source.revision}\n\n${markdown}`,
      };
    },
    pdf: renderDocumentPdf,
  };
}
