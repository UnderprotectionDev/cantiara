import type {
  ArchitectureModel,
  DiagramModel,
} from "@cantiara/db/schema/technical-diagram";
import { z } from "zod";

import type {
  AuthorityConversionInput,
  AuthorityConversionPreview,
  ConfirmAuthorityConversionInput,
  CreatableAuthorityMode,
  CreateTechnicalDiagramInput,
  ExternalSourceLink,
} from "./technical-diagram-authority";
import {
  structuralModelSchema,
  TECHNICAL_DIAGRAM_TYPES,
} from "./technical-diagram-structure";
import type {
  CreateDiagramVersionInput,
  RestoreDiagramVersionInput,
  TechnicalDiagramVersion,
} from "./technical-diagram-version";

export const technicalDiagramTypeSchema = z.enum(TECHNICAL_DIAGRAM_TYPES);

/** Typed canonical structural model of any of the three types. */
export const diagramModelSchema = structuralModelSchema;

/** Replaces the whole canonical model; the stored type picks the schema. */
export const saveTechnicalDiagramModelInputSchema = z
  .object({
    diagramId: z.string().min(1),
    model: structuralModelSchema,
  })
  .strict();

/** Coordinates are `Diagram View` metadata, never canonical content. */
export const saveDiagramLayoutInputSchema = z
  .object({
    diagramId: z.string().min(1),
    positions: z.record(
      z.string().min(1),
      z
        .object({
          x: z.number().finite().min(-100_000).max(100_000),
          y: z.number().finite().min(-100_000).max(100_000),
        })
        .strict(),
    ),
    viewId: z.string().min(1).optional(),
  })
  .strict();

export type SaveTechnicalDiagramModelInput = z.infer<
  typeof saveTechnicalDiagramModelInputSchema
>;
export type SaveDiagramLayoutInput = z.infer<
  typeof saveDiagramLayoutInputSchema
>;

export const mermaidConversionInputSchema = z
  .object({
    documentId: z.string().min(1),
    documentRevision: z.number().int().nonnegative(),
    blockStart: z.number().int().nonnegative(),
    blockEnd: z.number().int().positive(),
    originalBlock: z
      .enum(["Keep independent", "Replace with live reference"])
      .optional(),
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export const confirmMermaidConversionInputSchema = mermaidConversionInputSchema
  .extend({
    clientIdempotencyKey: z.string().uuid(),
  })
  .strict();

export const createDiagramViewInputSchema = z
  .object({
    clientIdempotencyKey: z.string().uuid(),
    diagramId: z.string().min(1),
    name: z.string().trim().min(1).max(255),
    selectedNodeIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type CreateDiagramViewInput = z.infer<
  typeof createDiagramViewInputSchema
>;

export type MermaidConversionInput = z.infer<
  typeof mermaidConversionInputSchema
>;
export type ConfirmMermaidConversionInput = z.infer<
  typeof confirmMermaidConversionInputSchema
>;

export interface TechnicalDiagramSource {
  authorityMode: CreatableAuthorityMode;
  /** Set only for `External Source Link`; content stays in the external tool. */
  externalSource: ExternalSourceLink | null;
  id: string;
  model: DiagramModel;
  /** Two-way authority-conversion origin: `Originates from` / `Derived`. */
  origins: Array<{
    authorityMode: CreatableAuthorityMode;
    diagramId: string;
    relation: "Originates from" | "Derived";
    title: string;
  }>;
  projectId: string;
  /** Live revision. A restore writes the next one; checkpoints never change. */
  revision: number;
  title: string;
  type: z.infer<typeof technicalDiagramTypeSchema>;
  view: {
    id: string;
    layout: Record<string, { x: number; y: number }>;
    name: string;
    selectedNodeIds: string[];
  } | null;
}

export interface TechnicalDiagramsAccess {
  convert: (
    accountId: string,
    input: ConfirmMermaidConversionInput,
  ) => Promise<TechnicalDiagramSource | null>;
  /** Writes only after the matching preview; mints a new identity. */
  convertAuthority: (
    accountId: string,
    input: ConfirmAuthorityConversionInput,
  ) => Promise<TechnicalDiagramSource | null>;
  create: (
    accountId: string,
    input: CreateTechnicalDiagramInput,
  ) => Promise<TechnicalDiagramSource | null>;
  /** Appends an immutable checkpoint of the live model; idempotent by key. */
  createVersion: (
    accountId: string,
    input: CreateDiagramVersionInput,
  ) => Promise<TechnicalDiagramVersion | null>;
  createView: (
    accountId: string,
    input: CreateDiagramViewInput,
  ) => Promise<TechnicalDiagramSource | null>;
  get: (
    accountId: string,
    diagramId: string,
    viewId?: string,
  ) => Promise<TechnicalDiagramSource | null>;
  /** Exact read of one checkpoint by its identity, never the live record. */
  getVersion: (
    accountId: string,
    versionId: string,
  ) => Promise<TechnicalDiagramVersion | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<TechnicalDiagramSource[]>;
  listVersions: (
    accountId: string,
    diagramId: string,
  ) => Promise<TechnicalDiagramVersion[] | null>;
  listViews: (
    accountId: string,
    diagramId: string,
  ) => Promise<Array<{
    id: string;
    layout: Record<string, { x: number; y: number }>;
    name: string;
    selectedNodeIds: string[];
  }> | null>;
  previewAuthorityConversion: (
    accountId: string,
    input: AuthorityConversionInput,
  ) => Promise<AuthorityConversionPreview | null>;
  previewConversion: (
    accountId: string,
    input: MermaidConversionInput,
  ) => Promise<{
    title: string;
    projectId: string;
    documentId: string;
    documentRevision: number;
    blockStart: number;
    blockEnd: number;
    type: "Technical Architecture";
    authorityMode: "Imported Independent Copy";
    originalBlock: "Keep independent" | "Replace with live reference";
    canConvert: boolean;
    model: ArchitectureModel;
    unparseableLines: Array<{ line: number; reason: string; text: string }>;
  } | null>;
  /** Writes a new live revision from a checkpoint; the checkpoint is untouched. */
  restoreVersion: (
    accountId: string,
    input: RestoreDiagramVersionInput,
  ) => Promise<TechnicalDiagramSource | null>;
  saveLayout: (
    accountId: string,
    input: SaveDiagramLayoutInput,
  ) => Promise<TechnicalDiagramSource | null>;
  /** Edits an authored or imported canonical model; never an External Source Link. */
  saveModel: (
    accountId: string,
    input: SaveTechnicalDiagramModelInput,
  ) => Promise<TechnicalDiagramSource | null>;
}
