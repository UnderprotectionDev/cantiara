import { z } from "zod";

export const technicalDiagramTypeSchema = z.enum([
  "Technical Architecture",
  "Data Model",
  "Technical Sequence",
]);

export const mermaidConversionInputSchema = z
  .object({
    documentId: z.string().min(1),
    documentRevision: z.number().int().nonnegative(),
    blockStart: z.number().int().nonnegative(),
    blockEnd: z.number().int().positive(),
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
  authorityMode: "Imported Independent Copy";
  id: string;
  model: {
    nodes: Array<{ id: string; label: string; kind: string }>;
    links: Array<{ from: string; to: string; label: string | null }>;
  };
  projectId: string;
  title: string;
  type: z.infer<typeof technicalDiagramTypeSchema>;
  view: { id: string; name: string; selectedNodeIds: string[] } | null;
}

export interface TechnicalDiagramsAccess {
  convert: (
    accountId: string,
    input: ConfirmMermaidConversionInput,
  ) => Promise<TechnicalDiagramSource | null>;
  createView: (
    accountId: string,
    input: CreateDiagramViewInput,
  ) => Promise<TechnicalDiagramSource | null>;
  get: (
    accountId: string,
    diagramId: string,
    viewId?: string,
  ) => Promise<TechnicalDiagramSource | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<TechnicalDiagramSource[]>;
  listViews: (
    accountId: string,
    diagramId: string,
  ) => Promise<Array<{
    id: string;
    name: string;
    selectedNodeIds: string[];
  }> | null>;
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
    originalBlock: "Keep independent";
    model: TechnicalDiagramSource["model"];
  } | null>;
}
