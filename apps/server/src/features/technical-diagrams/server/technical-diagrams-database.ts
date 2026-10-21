import { documentLiveDirectives } from "@cantiara/api/documents";
import {
  type AuthorityConversionInput,
  assertPreviewedConversion,
  type ConfirmAuthorityConversionInput,
  type CreateTechnicalDiagramInput,
  creatableAuthorityModeSchema,
  previewAuthorityConversion,
} from "@cantiara/api/technical-diagram-authority";
import {
  diagramGraph,
  emptyStructuralModel,
  parseStoredStructuralModel,
  resolveStructuralModel,
  StructuralModelError,
} from "@cantiara/api/technical-diagram-structure";
import {
  assertVersionBind,
  type CreateDiagramVersionInput,
  createCheckpoint,
  DiagramVersionError,
  type RestoreDiagramVersionInput,
  restoreFromCheckpoint,
  type TechnicalDiagramVersion,
} from "@cantiara/api/technical-diagram-version";
import type {
  MermaidConversionInput,
  SaveDiagramLayoutInput,
  SaveTechnicalDiagramModelInput,
  TechnicalDiagramSource,
  TechnicalDiagramsAccess,
} from "@cantiara/api/technical-diagrams";
import { technicalDiagramTypeSchema } from "@cantiara/api/technical-diagrams";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { usageLink } from "@cantiara/db/schema/relation";
import {
  diagramAuthorityOrigin,
  diagramDocumentOrigin,
  diagramVersion,
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { and, asc, eq, sql } from "drizzle-orm";

import { previewMermaidArchitecture } from "./mermaid-conversion";

export class MermaidConversionConflictError extends Error {}

const mermaidFenceOpening = /^ {0,3}(`{3,}|~{3,})mermaid[ \t]*$/;

function mermaidBlockSource(block: string): string | null {
  const lines = block.replaceAll("\r\n", "\n").split("\n");
  const opening = mermaidFenceOpening.exec(lines[0] ?? "");
  if (!opening || lines.length < 3) {
    return null;
  }
  const [, fence] = opening;
  const closing = lines.at(-1)?.trim() ?? "";
  if (
    !fence ||
    closing.length < fence.length ||
    ![...closing].every((character) => character === fence[0])
  ) {
    return null;
  }
  return lines.slice(1, -1).join("\n");
}

export function createDatabaseTechnicalDiagrams(
  database: Database,
): TechnicalDiagramsAccess {
  async function previewConversion(
    accountId: string,
    input: MermaidConversionInput,
  ) {
    const [row] = await database
      .select({ document, projectId: project.id })
      .from(document)
      .innerJoin(project, eq(document.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(document.id, input.documentId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    if (
      !row ||
      row.document.projectId === null ||
      row.document.revision !== input.documentRevision
    ) {
      return null;
    }
    const block = row.document.body.slice(input.blockStart, input.blockEnd);
    const source = mermaidBlockSource(block);
    if (!source || input.blockEnd > row.document.body.length) {
      throw new MermaidConversionConflictError(
        "The selected Mermaid block is unavailable.",
      );
    }
    const conversion = await previewMermaidArchitecture(source);
    return {
      title: input.title,
      projectId: row.projectId,
      documentId: input.documentId,
      documentRevision: input.documentRevision,
      blockStart: input.blockStart,
      blockEnd: input.blockEnd,
      type: "Technical Architecture" as const,
      authorityMode: "Imported Independent Copy" as const,
      originalBlock: input.originalBlock ?? ("Keep independent" as const),
      canConvert: conversion.canConvert,
      model: conversion.model,
      unparseableLines: conversion.unparseableLines,
    };
  }
  async function originsOf(
    diagramId: string,
  ): Promise<TechnicalDiagramSource["origins"]> {
    const columns = {
      authorityMode: technicalDiagram.authorityMode,
      diagramId: technicalDiagram.id,
      title: technicalDiagram.title,
    };
    const [originated, derived] = await Promise.all([
      database
        .select(columns)
        .from(diagramAuthorityOrigin)
        .innerJoin(
          technicalDiagram,
          eq(diagramAuthorityOrigin.sourceDiagramId, technicalDiagram.id),
        )
        .where(eq(diagramAuthorityOrigin.targetDiagramId, diagramId)),
      database
        .select(columns)
        .from(diagramAuthorityOrigin)
        .innerJoin(
          technicalDiagram,
          eq(diagramAuthorityOrigin.targetDiagramId, technicalDiagram.id),
        )
        .where(eq(diagramAuthorityOrigin.sourceDiagramId, diagramId)),
    ]);
    const origins: TechnicalDiagramSource["origins"] = [];
    for (const [relation, rows] of [
      ["Originates from", originated],
      ["Derived", derived],
    ] as const) {
      for (const row of rows) {
        const mode = creatableAuthorityModeSchema.safeParse(row.authorityMode);
        if (mode.success) {
          origins.push({ ...row, authorityMode: mode.data, relation });
        }
      }
    }
    return origins;
  }
  async function ownedProjectId(accountId: string, projectId: string) {
    const [row] = await database
      .select({ id: project.id })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
      )
      .limit(1);
    return row?.id ?? null;
  }
  function sameExternalSource(
    a: TechnicalDiagramSource["externalSource"],
    b: TechnicalDiagramSource["externalSource"],
  ) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  async function insertDiagram(
    executor: Pick<Database, "insert">,
    values: {
      authorityMode: TechnicalDiagramSource["authorityMode"];
      externalSource: TechnicalDiagramSource["externalSource"];
      id: string;
      model: TechnicalDiagramSource["model"];
      projectId: string;
      title: string;
      type: TechnicalDiagramSource["type"];
    },
  ) {
    const [created] = await executor
      .insert(technicalDiagram)
      .values({
        id: values.id,
        projectId: values.projectId,
        title: values.title,
        type: values.type,
        authorityMode: values.authorityMode,
        model: values.model,
        externalUrl: values.externalSource?.url ?? null,
        externalRevision: values.externalSource?.revision ?? null,
        externalTool: values.externalSource?.tool ?? null,
        externalCheckedAt: values.externalSource
          ? new Date(values.externalSource.lastCheckedAt)
          : null,
      })
      .onConflictDoNothing()
      .returning({ id: technicalDiagram.id });
    if (created) {
      await executor.insert(diagramView).values({
        id: `${values.id}:default`,
        diagramId: values.id,
        name: "Default",
        selectedNodeIds: diagramGraph(values.model).nodes.map(({ id }) => id),
      });
    }
    return Boolean(created);
  }
  async function create(accountId: string, input: CreateTechnicalDiagramInput) {
    const projectId = await ownedProjectId(accountId, input.projectId);
    if (!projectId) {
      return null;
    }
    const diagramId = input.clientIdempotencyKey;
    const externalSource =
      input.authorityMode === "External Source Link"
        ? input.externalSource
        : null;
    const model =
      input.authorityMode === "Product-authored Model"
        ? resolveStructuralModel(input.type, input.model)
        : emptyStructuralModel(input.type);
    await assertSequenceBinds(accountId, projectId, model, null);
    const inserted = await database.transaction((tx) =>
      insertDiagram(tx, {
        authorityMode: input.authorityMode,
        externalSource,
        id: diagramId,
        model,
        projectId,
        title: input.title,
        type: input.type,
      }),
    );
    const saved = await get(accountId, diagramId);
    if (
      !inserted &&
      (saved?.projectId !== projectId ||
        saved.title !== input.title ||
        saved.type !== input.type ||
        saved.authorityMode !== input.authorityMode ||
        !sameExternalSource(saved.externalSource, externalSource) ||
        JSON.stringify(saved.model) !== JSON.stringify(model))
    ) {
      throw new MermaidConversionConflictError(
        "This confirmation key was used for another Technical Diagram.",
      );
    }
    return saved;
  }
  async function previewAuthority(
    accountId: string,
    input: AuthorityConversionInput,
  ) {
    const source = await get(accountId, input.sourceDiagramId);
    return source ? previewAuthorityConversion(source, input) : null;
  }
  async function convertAuthority(
    accountId: string,
    input: ConfirmAuthorityConversionInput,
  ) {
    const source = await get(accountId, input.sourceDiagramId);
    if (!source) {
      return null;
    }
    const targetId = input.clientIdempotencyKey;
    const [prior] = await database
      .select()
      .from(diagramAuthorityOrigin)
      .where(eq(diagramAuthorityOrigin.targetDiagramId, targetId))
      .limit(1);
    if (prior) {
      const repeated = await get(accountId, targetId);
      if (
        repeated?.title !== input.title ||
        repeated.authorityMode !== input.targetMode ||
        prior.sourceDiagramId !== source.id ||
        !sameExternalSource(
          repeated.externalSource,
          input.externalSource ?? null,
        )
      ) {
        throw new MermaidConversionConflictError(
          "This confirmation key was used for another conversion.",
        );
      }
      return repeated;
    }
    const preview = await assertPreviewedConversion(source, input);
    await database.transaction(async (tx) => {
      const inserted = await insertDiagram(tx, {
        authorityMode: preview.targetMode,
        externalSource: input.externalSource ?? null,
        id: targetId,
        model:
          preview.targetMode === "External Source Link"
            ? emptyStructuralModel(source.type)
            : source.model,
        projectId: source.projectId,
        title: input.title,
        type: source.type,
      });
      if (!inserted) {
        throw new MermaidConversionConflictError(
          "This confirmation key was used for another Technical Diagram.",
        );
      }
      await tx.insert(diagramAuthorityOrigin).values({
        loss: preview.loss,
        sourceDiagramId: source.id,
        sourceMode: source.authorityMode,
        targetDiagramId: targetId,
        targetMode: preview.targetMode,
      });
    });
    return get(accountId, targetId);
  }
  async function get(
    accountId: string,
    diagramId: string,
    viewId?: string,
  ): Promise<TechnicalDiagramSource | null> {
    const [row] = await database
      .select({ diagram: technicalDiagram })
      .from(technicalDiagram)
      .innerJoin(project, eq(technicalDiagram.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(technicalDiagram.id, diagramId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    const mode = creatableAuthorityModeSchema.safeParse(
      row?.diagram.authorityMode,
    );
    if (!(row && mode.success)) {
      return null;
    }
    const [view] = await database
      .select()
      .from(diagramView)
      .where(
        and(
          eq(diagramView.diagramId, diagramId),
          viewId ? eq(diagramView.id, viewId) : eq(diagramView.name, "Default"),
        ),
      )
      .limit(1);
    if (viewId && !view) {
      return null;
    }
    const { diagram } = row;
    const type = technicalDiagramTypeSchema.safeParse(diagram.type);
    const parsedModel = type.success
      ? parseStoredStructuralModel(type.data, diagram.model)
      : null;
    if (!(type.success && parsedModel)) {
      return null;
    }
    return {
      id: diagram.id,
      projectId: diagram.projectId,
      title: diagram.title,
      type: type.data,
      authorityMode: mode.data,
      externalSource:
        mode.data === "External Source Link" &&
        diagram.externalUrl &&
        diagram.externalTool &&
        diagram.externalCheckedAt
          ? {
              url: diagram.externalUrl,
              revision: diagram.externalRevision,
              tool: diagram.externalTool,
              lastCheckedAt: diagram.externalCheckedAt.toISOString(),
            }
          : null,
      model: parsedModel,
      revision: diagram.revision,
      origins: await originsOf(diagramId),
      view: view
        ? {
            id: view.id,
            layout: view.layout,
            name: view.name,
            selectedNodeIds: view.selectedNodeIds,
          }
        : null,
    };
  }
  /**
   * A Sequence lifeline may bind an exact Architecture node of the same
   * Project. A new or changed bind must name an existing node and its current
   * label; an unchanged bind is kept as written, so a moved or deleted source
   * node, or a newer version, never retargets it.
   */
  async function assertSequenceBinds(
    accountId: string,
    projectId: string,
    model: TechnicalDiagramSource["model"],
    previous: TechnicalDiagramSource["model"] | null,
  ) {
    if (!("participants" in model)) {
      return;
    }
    const before = new Map(
      previous && "participants" in previous
        ? previous.participants.map(({ id, bind }) => [id, bind])
        : [],
    );
    const changed = model.participants.filter(
      ({ bind, id }) =>
        bind && JSON.stringify(before.get(id)) !== JSON.stringify(bind),
    );
    await Promise.all(
      changed.map(async ({ bind, label }) => {
        if (bind && !(await bindIsValid(accountId, projectId, bind))) {
          throw new StructuralModelError(
            `Lifeline ${label} must bind an existing Architecture node of this Project.`,
          );
        }
      }),
    );
  }
  async function bindIsValid(
    accountId: string,
    projectId: string,
    bind: {
      boundLabel: string;
      diagramId: string;
      nodeId: string;
      versionId: string | null;
    },
  ) {
    if (bind.versionId !== null) {
      const version = await getVersion(accountId, bind.versionId);
      const owner = version ? await get(accountId, version.diagramId) : null;
      if (owner?.projectId !== projectId) {
        return false;
      }
      try {
        assertVersionBind(version, bind);
      } catch (error) {
        if (error instanceof DiagramVersionError) {
          return false;
        }
        throw error;
      }
      return true;
    }
    const target = await get(accountId, bind.diagramId);
    const node =
      target?.projectId === projectId &&
      target.type === "Technical Architecture" &&
      "nodes" in target.model
        ? target.model.nodes.find(({ id }) => id === bind.nodeId)
        : undefined;
    return node?.label === bind.boundLabel;
  }
  /** A view keeps only elements that still exist in the live model. */
  async function pruneViews(
    tx: Pick<Database, "select" | "update">,
    diagramId: string,
    model: TechnicalDiagramSource["model"],
  ) {
    const ids = new Set(diagramGraph(model).nodes.map(({ id }) => id));
    const views = await tx
      .select()
      .from(diagramView)
      .where(eq(diagramView.diagramId, diagramId));
    await Promise.all(
      views.map((view) =>
        tx
          .update(diagramView)
          .set({
            layout: Object.fromEntries(
              Object.entries(view.layout).filter(([id]) => ids.has(id)),
            ),
            selectedNodeIds: view.selectedNodeIds.filter((id) => ids.has(id)),
          })
          .where(eq(diagramView.id, view.id)),
      ),
    );
  }
  function toVersion(
    row: typeof diagramVersion.$inferSelect,
  ): TechnicalDiagramVersion | null {
    const type = technicalDiagramTypeSchema.safeParse(row.type);
    const mode = creatableAuthorityModeSchema.safeParse(row.authorityMode);
    const model = type.success
      ? parseStoredStructuralModel(type.data, row.model)
      : null;
    if (!(type.success && mode.success && model)) {
      return null;
    }
    return {
      authorityMode: mode.data,
      createdAt: row.createdAt.toISOString(),
      diagramId: row.diagramId,
      id: row.id,
      model,
      name: row.name,
      number: row.number,
      revision: row.revision,
      type: type.data,
    };
  }
  async function getVersion(accountId: string, versionId: string) {
    const [row] = await database
      .select({ version: diagramVersion })
      .from(diagramVersion)
      .innerJoin(
        technicalDiagram,
        eq(diagramVersion.diagramId, technicalDiagram.id),
      )
      .innerJoin(project, eq(technicalDiagram.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(diagramVersion.id, versionId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    return row ? toVersion(row.version) : null;
  }
  async function listVersions(accountId: string, diagramId: string) {
    if (!(await get(accountId, diagramId))) {
      return null;
    }
    const rows = await database
      .select()
      .from(diagramVersion)
      .where(eq(diagramVersion.diagramId, diagramId))
      .orderBy(asc(diagramVersion.number));
    return rows
      .map(toVersion)
      .filter((value): value is TechnicalDiagramVersion => value !== null);
  }
  async function createVersion(
    accountId: string,
    input: CreateDiagramVersionInput,
  ) {
    const current = await get(accountId, input.diagramId);
    if (!current) {
      return null;
    }
    const prior = await getVersion(accountId, input.clientIdempotencyKey);
    if (prior) {
      if (prior.diagramId !== current.id || prior.name !== input.name) {
        throw new DiagramVersionError(
          "This confirmation key was used for another Diagram Version.",
        );
      }
      return prior;
    }
    const createdId = await database.transaction(async (tx) => {
      // Serialize numbering per diagram, then checkpoint the locked live row.
      const [locked] = await tx
        .select({
          model: technicalDiagram.model,
          revision: technicalDiagram.revision,
        })
        .from(technicalDiagram)
        .where(eq(technicalDiagram.id, current.id))
        .for("update")
        .limit(1);
      const model = locked
        ? parseStoredStructuralModel(current.type, locked.model)
        : null;
      if (!(locked && model)) {
        throw new DiagramVersionError("The Technical Diagram is unavailable.");
      }
      const [last] = await tx
        .select({
          number: sql<number>`coalesce(max(${diagramVersion.number}), 0)`,
        })
        .from(diagramVersion)
        .where(eq(diagramVersion.diagramId, current.id));
      const checkpoint = createCheckpoint(
        { ...current, model, revision: locked.revision },
        {
          createdAt: new Date().toISOString(),
          id: input.clientIdempotencyKey,
          name: input.name,
          number: Number(last?.number ?? 0) + 1,
        },
      );
      const [created] = await tx
        .insert(diagramVersion)
        .values({
          authorityMode: checkpoint.authorityMode,
          diagramId: checkpoint.diagramId,
          id: checkpoint.id,
          model: checkpoint.model,
          name: checkpoint.name,
          number: checkpoint.number,
          revision: checkpoint.revision,
          type: checkpoint.type,
        })
        .onConflictDoNothing()
        .returning({ id: diagramVersion.id });
      return created?.id ?? null;
    });
    if (!createdId) {
      throw new DiagramVersionError(
        "Diagram Version name or confirmation key is already used.",
      );
    }
    return getVersion(accountId, createdId);
  }
  async function restoreVersion(
    accountId: string,
    input: RestoreDiagramVersionInput,
  ) {
    const current = await get(accountId, input.diagramId);
    const version = await getVersion(accountId, input.versionId);
    if (!(current && version)) {
      return null;
    }
    // The checkpoint's binds were validated when it was taken and are exact,
    // so restore writes the checkpoint as it was and re-resolves nothing.
    const restored = restoreFromCheckpoint(
      current,
      version,
      input.expectedRevision,
    );
    await database.transaction(async (tx) => {
      const [updated] = await tx
        .update(technicalDiagram)
        .set({
          model: restored.model,
          revision: restored.revision,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(technicalDiagram.id, current.id),
            eq(technicalDiagram.revision, input.expectedRevision),
          ),
        )
        .returning({ id: technicalDiagram.id });
      if (!updated) {
        throw new DiagramVersionError(
          "The Technical Diagram changed after it was shown. Reload before restoring.",
        );
      }
      await pruneViews(tx, current.id, restored.model);
    });
    return get(accountId, current.id);
  }
  async function saveModel(
    accountId: string,
    input: SaveTechnicalDiagramModelInput,
  ) {
    const current = await get(accountId, input.diagramId);
    if (!current) {
      return null;
    }
    if (current.authorityMode === "External Source Link") {
      throw new StructuralModelError(
        "An External Source Link keeps its content in the external tool.",
      );
    }
    const model = resolveStructuralModel(current.type, input.model);
    await assertSequenceBinds(
      accountId,
      current.projectId,
      model,
      current.model,
    );
    await database.transaction(async (tx) => {
      await tx
        .update(technicalDiagram)
        .set({
          model,
          revision: sql`${technicalDiagram.revision} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(technicalDiagram.id, input.diagramId));
      await pruneViews(tx, input.diagramId, model);
    });
    return get(accountId, input.diagramId);
  }
  async function saveLayout(accountId: string, input: SaveDiagramLayoutInput) {
    const current = await get(accountId, input.diagramId, input.viewId);
    if (!current?.view) {
      return null;
    }
    const ids = new Set(diagramGraph(current.model).nodes.map(({ id }) => id));
    if (Object.keys(input.positions).some((id) => !ids.has(id))) {
      throw new StructuralModelError("Layout names an unknown element.");
    }
    await database
      .update(diagramView)
      .set({ layout: { ...current.view.layout, ...input.positions } })
      .where(eq(diagramView.id, current.view.id));
    return get(accountId, input.diagramId, current.view.id);
  }
  return {
    convertAuthority,
    create,
    createVersion,
    get,
    getVersion,
    listVersions,
    restoreVersion,
    previewAuthorityConversion: previewAuthority,
    previewConversion,
    saveLayout,
    saveModel,
    async createView(accountId, input) {
      const diagram = await get(accountId, input.diagramId);
      if (!diagram) {
        return null;
      }
      const allowed = new Set(
        diagramGraph(diagram.model).nodes.map(({ id }) => id),
      );
      if (
        new Set(input.selectedNodeIds).size !== input.selectedNodeIds.length ||
        input.selectedNodeIds.some((id) => !allowed.has(id))
      ) {
        throw new MermaidConversionConflictError(
          "Diagram View contains an unknown element.",
        );
      }
      const existing = await get(
        accountId,
        input.diagramId,
        input.clientIdempotencyKey,
      );
      if (existing?.view) {
        if (
          existing.view.name !== input.name ||
          JSON.stringify(existing.view.selectedNodeIds) !==
            JSON.stringify(input.selectedNodeIds)
        ) {
          throw new MermaidConversionConflictError(
            "This confirmation key was used for another Diagram View.",
          );
        }
        return existing;
      }
      const [created] = await database
        .insert(diagramView)
        .values({
          id: input.clientIdempotencyKey,
          diagramId: input.diagramId,
          name: input.name,
          selectedNodeIds: input.selectedNodeIds,
        })
        .onConflictDoNothing()
        .returning({ id: diagramView.id });
      if (!created) {
        const repeated = await get(
          accountId,
          input.diagramId,
          input.clientIdempotencyKey,
        );
        if (
          repeated?.view?.name === input.name &&
          JSON.stringify(repeated.view.selectedNodeIds) ===
            JSON.stringify(input.selectedNodeIds)
        ) {
          return repeated;
        }
        throw new MermaidConversionConflictError(
          "Diagram View name or confirmation key is already used.",
        );
      }
      return get(accountId, input.diagramId, created.id);
    },
    async convert(accountId, input) {
      const diagramId = input.clientIdempotencyKey;
      async function repeatedConversion() {
        const existing = await get(accountId, diagramId);
        if (!existing) {
          return null;
        }
        const [origin] = await database
          .select()
          .from(diagramDocumentOrigin)
          .where(eq(diagramDocumentOrigin.diagramId, diagramId))
          .limit(1);
        const [documentAfter] = await database
          .select({ body: document.body })
          .from(document)
          .where(eq(document.id, input.documentId))
          .limit(1);
        const reference = `:::live-diagram{diagramId="${diagramId}"}`;
        const actualOutcome = documentAfter?.body.includes(reference)
          ? "Replace with live reference"
          : "Keep independent";
        if (
          !origin ||
          existing.title !== input.title ||
          origin.documentId !== input.documentId ||
          origin.documentRevision !== input.documentRevision ||
          origin.blockStart !== input.blockStart ||
          origin.blockEnd !== input.blockEnd ||
          actualOutcome !== (input.originalBlock ?? "Keep independent")
        ) {
          throw new MermaidConversionConflictError(
            "This confirmation key was used for another conversion.",
          );
        }
        return existing;
      }
      const existing = await repeatedConversion();
      if (existing) {
        return existing;
      }
      const preview = await previewConversion(accountId, input);
      if (!preview) {
        return null;
      }
      if (!preview.canConvert) {
        throw new MermaidConversionConflictError(
          "The Mermaid block has no convertible diagram edges.",
        );
      }
      const inserted = await database.transaction(async (tx) => {
        const [saved] = await tx
          .select({
            body: document.body,
            projectId: project.id,
            revision: document.revision,
            workspaceId: workspace.id,
          })
          .from(document)
          .innerJoin(project, eq(document.projectId, project.id))
          .innerJoin(workspace, eq(project.workspaceId, workspace.id))
          .where(
            and(
              eq(document.id, input.documentId),
              eq(workspace.ownerAccountId, accountId),
            ),
          )
          .for("update")
          .limit(1);
        if (saved?.revision !== input.documentRevision) {
          throw new MermaidConversionConflictError(
            "The Document changed after preview.",
          );
        }
        const [created] = await tx
          .insert(technicalDiagram)
          .values({
            id: diagramId,
            projectId: preview.projectId,
            title: input.title,
            type: preview.type,
            authorityMode: preview.authorityMode,
            model: preview.model,
          })
          .onConflictDoNothing()
          .returning({ id: technicalDiagram.id });
        if (!created) {
          return false;
        }
        await tx.insert(diagramDocumentOrigin).values({
          diagramId,
          documentId: input.documentId,
          documentRevision: input.documentRevision,
          blockStart: input.blockStart,
          blockEnd: input.blockEnd,
        });
        await tx.insert(diagramView).values({
          id: `${diagramId}:default`,
          diagramId,
          name: "Default",
          selectedNodeIds: preview.model.nodes.map(({ id }) => id),
        });
        if (
          (input.originalBlock ?? "Keep independent") ===
          "Replace with live reference"
        ) {
          const liveReference = `:::live-diagram{diagramId="${diagramId}"}`;
          const nextBody =
            saved.body.slice(0, input.blockStart) +
            liveReference +
            saved.body.slice(input.blockEnd);
          const [updatedDocument] = await tx
            .update(document)
            .set({
              body: nextBody,
              revision: input.documentRevision + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(document.id, input.documentId),
                eq(document.revision, input.documentRevision),
              ),
            )
            .returning({ id: document.id });
          if (!updatedDocument) {
            throw new MermaidConversionConflictError(
              "The Document changed after preview.",
            );
          }
          const ordinal = documentLiveDirectives(nextBody).findIndex(
            ({ id, kind }) => id === diagramId && kind === "Technical Diagram",
          );
          if (ordinal < 0) {
            throw new MermaidConversionConflictError(
              "The live Technical Diagram reference could not be written.",
            );
          }
          await tx.insert(usageLink).values({
            id: crypto.randomUUID(),
            kind: "Live block",
            location: { documentLiveOrdinal: ordinal },
            revision: 1,
            sourceRecordId: diagramId,
            sourceRecordType: "Technical Diagram",
            surfaceRecordId: input.documentId,
            surfaceRecordType: "Document",
            workspaceId: saved.workspaceId,
          });
        }
        return true;
      });
      if (!inserted) {
        return repeatedConversion();
      }
      return get(accountId, diagramId);
    },
    async list(accountId, projectId) {
      const rows = await database
        .select({ id: technicalDiagram.id })
        .from(technicalDiagram)
        .innerJoin(project, eq(technicalDiagram.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(technicalDiagram.projectId, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      return (
        await Promise.all(rows.map(({ id }) => get(accountId, id)))
      ).filter((value): value is TechnicalDiagramSource => value !== null);
    },
    async listViews(accountId, diagramId) {
      if (!(await get(accountId, diagramId))) {
        return null;
      }
      return database
        .select({
          id: diagramView.id,
          layout: diagramView.layout,
          name: diagramView.name,
          selectedNodeIds: diagramView.selectedNodeIds,
        })
        .from(diagramView)
        .where(eq(diagramView.diagramId, diagramId));
    },
  };
}
