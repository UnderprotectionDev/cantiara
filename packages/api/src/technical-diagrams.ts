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
import type {
  ConfirmConvertToRecordInput,
  ConvertToRecordPlan,
  DiagramRecordCardRecord,
  DiagramRecordCardView,
  DiagramRecordLinkResult,
  MoveDiagramRecordCardInput,
  PlaceDiagramRecordCardInput,
  PreviewConvertToRecordInput,
  RemoveDiagramRecordCardInput,
} from "./technical-diagram-card";
import type {
  MermaidConversionEffects,
  MermaidConversionSource,
} from "./technical-diagram-mermaid";
import {
  structuralModelSchema,
  TECHNICAL_DIAGRAM_TYPES,
} from "./technical-diagram-structure";
import type {
  CreateDiagramVersionInput,
  DiagramVersionReference,
  RestoreDiagramVersionInput,
  TechnicalDiagramVersion,
} from "./technical-diagram-version";
import type {
  SaveTechnicalDiagramViewportInput,
  TechnicalDiagramViewport,
} from "./technical-diagram-viewport";

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
  /**
   * Set only when a card reads one exact checkpoint: `model`, `revision` and
   * the view selection are then that Diagram Version's. Absent means `Live`.
   */
  exactVersion?: DiagramVersionReference | null;
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
  convertAuthority: (
    accountId: string,
    input: ConfirmAuthorityConversionInput,
  ) => Promise<TechnicalDiagramSource | null>;
  /** Writes only after the matching preview; mints a new identity. */
  /**
   * Writes exactly one İş, Karar, Risk or Açık Soru from a node of an exact
   * Diagram Version after the matching preview, plus its link to that version.
   * Never touches the diagram or its authority mode. Idempotent by key.
   */
  convertToRecord: (
    accountId: string,
    input: ConfirmConvertToRecordInput,
  ) => Promise<DiagramRecordLinkResult | null>;
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
  getVersion: (
    accountId: string,
    versionId: string,
  ) => Promise<TechnicalDiagramVersion | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<TechnicalDiagramSource[]>;
  /** Exact read of one checkpoint by its identity, never the live record. */
  /** Read-only live cards of existing records placed on one diagram canvas. */
  listRecordCards: (
    accountId: string,
    diagramId: string,
  ) => Promise<DiagramRecordCardView[] | null>;
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
  moveRecordCard: (
    accountId: string,
    input: MoveDiagramRecordCardInput,
  ) => Promise<DiagramRecordCardRecord | null>;
  /** Stores the source identity and position only; the record is never written. */
  placeRecordCard: (
    accountId: string,
    input: PlaceDiagramRecordCardInput,
  ) => Promise<DiagramRecordCardRecord | null>;
  previewAuthorityConversion: (
    accountId: string,
    input: AuthorityConversionInput,
  ) => Promise<AuthorityConversionPreview | null>;
  previewConversion: (
    accountId: string,
    input: MermaidConversionInput,
  ) => Promise<
    | (MermaidConversionEffects & {
        source: MermaidConversionSource;
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
      })
    | null
  >;
  previewConvertToRecord: (
    accountId: string,
    input: PreviewConvertToRecordInput,
  ) => Promise<ConvertToRecordPlan | null>;
  removeRecordCard: (
    accountId: string,
    input: RemoveDiagramRecordCardInput,
  ) => Promise<boolean>;
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
  /**
   * Saves the Account's own viewport for one diagram view (spec 59 #425). Writes
   * no diagram, view, version or card; stale collapsed group ids are dropped.
   * Null when the diagram (or view) is not the Account's.
   */
  saveViewport: (
    accountId: string,
    input: SaveTechnicalDiagramViewportInput,
  ) => Promise<TechnicalDiagramViewport | null>;
  /** The Account's own saved viewport; `viewport` is null when none was saved. Null when the diagram is not the Account's. */
  viewport: (
    accountId: string,
    input: { diagramId: string; viewId?: string },
  ) => Promise<{ viewport: TechnicalDiagramViewport | null } | null>;
}
