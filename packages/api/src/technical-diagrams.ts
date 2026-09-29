import type { DiagramModel } from "@cantiara/db/schema/technical-diagram";
import { z } from "zod";

export const technicalDiagramTypeSchema = z.enum([
  "Technical Architecture",
  "Data Model",
  "Technical Sequence",
]);

export const diagramModelSchema = z
  .object({
    nodes: z.array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1),
          kind: z.enum([
            "Component",
            "Service",
            "Datastore",
            "Queue/Event Bus",
            "External System",
            "Boundary",
          ]),
        })
        .strict(),
    ),
    links: z.array(
      z
        .object({
          from: z.string().min(1),
          to: z.string().min(1),
          label: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((model, context) => {
    const ids = new Set(model.nodes.map(({ id }) => id));
    if (ids.size !== model.nodes.length) {
      context.addIssue({
        code: "custom",
        message: "Duplicate diagram node ID.",
      });
    }
    for (const link of model.links) {
      if (!(ids.has(link.from) && ids.has(link.to))) {
        context.addIssue({
          code: "custom",
          message: "Diagram link target is missing.",
        });
      }
    }
  });

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
  authorityMode: "Imported Independent Copy" | "Product-authored Model";
  id: string;
  model: DiagramModel;
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
    originalBlock: "Keep independent" | "Replace with live reference";
    canConvert: boolean;
    model: TechnicalDiagramSource["model"];
    unparseableLines: Array<{ line: number; reason: string; text: string }>;
  } | null>;
}
