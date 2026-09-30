import { documentLiveDirectives } from "@cantiara/api/documents";
import type {
  MermaidConversionInput,
  TechnicalDiagramSource,
  TechnicalDiagramsAccess,
} from "@cantiara/api/technical-diagrams";
import { diagramModelSchema } from "@cantiara/api/technical-diagrams";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import { usageLink } from "@cantiara/db/schema/relation";
import {
  diagramDocumentOrigin,
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { and, eq } from "drizzle-orm";

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
    if (
      row?.diagram.authorityMode !== "Imported Independent Copy" &&
      row?.diagram.authorityMode !== "Product-authored Model"
    ) {
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
    const parsedModel = diagramModelSchema.safeParse(diagram.model);
    if (!parsedModel.success) {
      return null;
    }
    return {
      id: diagram.id,
      projectId: diagram.projectId,
      title: diagram.title,
      type: diagram.type as TechnicalDiagramSource["type"],
      authorityMode:
        diagram.authorityMode as TechnicalDiagramSource["authorityMode"],
      model: parsedModel.data,
      view: view
        ? {
            id: view.id,
            name: view.name,
            selectedNodeIds: view.selectedNodeIds,
          }
        : null,
    };
  }
  return {
    get,
    previewConversion,
    async createView(accountId, input) {
      const diagram = await get(accountId, input.diagramId);
      if (!diagram) {
        return null;
      }
      const allowed = new Set(diagram.model.nodes.map(({ id }) => id));
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
          name: diagramView.name,
          selectedNodeIds: diagramView.selectedNodeIds,
        })
        .from(diagramView)
        .where(eq(diagramView.diagramId, diagramId));
    },
  };
}
