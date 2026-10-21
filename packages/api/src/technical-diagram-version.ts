import type { DiagramModel } from "@cantiara/db/schema/technical-diagram";
import { z } from "zod";

import type { CreatableAuthorityMode } from "./technical-diagram-authority";
import type { TechnicalDiagramType } from "./technical-diagram-structure";

/**
 * `Diagram View` and `Diagram Version` (spec 59 #422). A view is a named,
 * copy-free selection plus layout; a version is an immutable checkpoint of
 * the canonical structural model that other records pin by its identity.
 */
export const DIAGRAM_VERSION_LABELS = {
  version: "Diagram Version",
  view: "Diagram View",
} as const;

export class DiagramVersionError extends Error {}

/** The live diagram facts a checkpoint or restore reads. */
export interface VersionedDiagram {
  authorityMode: CreatableAuthorityMode;
  id: string;
  model: DiagramModel;
  /** Live revision; restore writes the next one. */
  revision: number;
  type: TechnicalDiagramType;
}

/**
 * Immutable, append-only checkpoint. It is neither a Git tag nor an image
 * export, and it copies the authority mode of its diagram without minting one.
 */
export interface TechnicalDiagramVersion {
  authorityMode: CreatableAuthorityMode;
  createdAt: string;
  diagramId: string;
  id: string;
  model: DiagramModel;
  name: string;
  /** Per-diagram ordinal, never reused. */
  number: number;
  /** Live revision the checkpoint was taken at. */
  revision: number;
  type: TechnicalDiagramType;
}

/** The exact reference Karar, İş, Proje Sürümü, evidence, share or export pin. */
export interface DiagramVersionReference {
  diagramId: string;
  kind: "Diagram Version";
  name: string;
  number: number;
  versionId: string;
}

export const createDiagramVersionInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    diagramId: z.string().min(1),
    name: z.string().trim().min(1).max(255),
  })
  .strict();

/** Restore names the live revision it was shown against (compare-and-set). */
export const restoreDiagramVersionInputSchema = z
  .object({
    diagramId: z.string().min(1),
    expectedRevision: z.number().int().min(1),
    versionId: z.string().min(1),
  })
  .strict();

export type CreateDiagramVersionInput = z.infer<
  typeof createDiagramVersionInputSchema
>;
export type RestoreDiagramVersionInput = z.infer<
  typeof restoreDiagramVersionInputSchema
>;

const cloneModel = (model: DiagramModel): DiagramModel =>
  JSON.parse(JSON.stringify(model)) as DiagramModel;

function assertVersionable(diagram: VersionedDiagram) {
  if (diagram.authorityMode === "External Source Link") {
    throw new DiagramVersionError(
      "An External Source Link keeps its content in the external tool, so it has no Diagram Version.",
    );
  }
}

export function createCheckpoint(
  diagram: VersionedDiagram,
  values: { createdAt: string; id: string; name: string; number: number },
): TechnicalDiagramVersion {
  assertVersionable(diagram);
  return {
    authorityMode: diagram.authorityMode,
    createdAt: values.createdAt,
    diagramId: diagram.id,
    id: values.id,
    model: cloneModel(diagram.model),
    name: values.name,
    number: values.number,
    revision: diagram.revision,
    type: diagram.type,
  };
}

export function diagramVersionReference(
  version: Pick<
    TechnicalDiagramVersion,
    "diagramId" | "id" | "name" | "number"
  >,
): DiagramVersionReference {
  return {
    diagramId: version.diagramId,
    kind: "Diagram Version",
    name: version.name,
    number: version.number,
    versionId: version.id,
  };
}

/**
 * Restore never rewrites the checkpoint: it yields the model and the next live
 * revision to write on the live diagram.
 */
export function restoreFromCheckpoint(
  diagram: VersionedDiagram,
  version: TechnicalDiagramVersion,
  expectedRevision: number,
): { model: DiagramModel; revision: number } {
  assertVersionable(diagram);
  if (version.diagramId !== diagram.id || version.type !== diagram.type) {
    throw new DiagramVersionError(
      "This Diagram Version belongs to another Technical Diagram.",
    );
  }
  if (expectedRevision !== diagram.revision) {
    throw new DiagramVersionError(
      "The Technical Diagram changed after it was shown. Reload before restoring.",
    );
  }
  return { model: cloneModel(version.model), revision: diagram.revision + 1 };
}

/**
 * A Sequence lifeline bind that carries a `versionId` is checked against that
 * checkpoint, not the live source, so a source that moved on never retargets
 * it and never invalidates it.
 */
export function assertVersionBind(
  version: TechnicalDiagramVersion | null,
  bind: { boundLabel: string; diagramId: string; nodeId: string },
) {
  if (
    !version ||
    version.diagramId !== bind.diagramId ||
    version.type !== "Technical Architecture" ||
    !("nodes" in version.model)
  ) {
    throw new DiagramVersionError(
      "A lifeline must pin an exact Diagram Version of an Architecture diagram.",
    );
  }
  const node = version.model.nodes.find(({ id }) => id === bind.nodeId);
  if (!node || node.label !== bind.boundLabel) {
    throw new DiagramVersionError(
      "The pinned Diagram Version has no such Architecture node.",
    );
  }
}
