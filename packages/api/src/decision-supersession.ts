import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { decisionRecordSchema } from "./project-source-records";

const id = z.string().trim().min(1).max(255);
export const decisionSupersessionSelectionSchema = z
  .object({
    projectId: id,
    successorId: id,
    predecessorIds: z.array(id).min(1).max(100),
    operation: z.enum(["supersede", "remove"]),
    rationale: z.string().trim().max(20_000).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.predecessorIds).size !== value.predecessorIds.length ||
      value.predecessorIds.includes(value.successorId)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Select distinct Decisions; a Decision cannot supersede itself.",
      });
    }
  });
export const decisionSupersessionCommandSchema =
  decisionSupersessionSelectionSchema.safeExtend({
    ...humanMutationEnvelopeSchema.shape,
    previewFingerprint: z.string().min(1),
  });
export const decisionSupersessionRelationSchema = z.object({
  predecessorId: id,
  successorId: id,
  rationale: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  actorId: id,
});
export const decisionSupersessionTransitionSchema = z.object({
  operation: z.enum(["supersede", "remove"]),
  predecessorIds: z.array(id),
  successorId: id,
  rationale: z.string().nullable(),
  actorId: id,
  occurredAt: z.iso.datetime(),
});
export type DecisionSupersessionTransition = z.infer<
  typeof decisionSupersessionTransitionSchema
>;
export const decisionSupersessionGraphSchema = z.object({
  transition: decisionSupersessionTransitionSchema.optional(),
  records: z.array(decisionRecordSchema),
  relations: z.array(decisionSupersessionRelationSchema),
  evidence: z.array(
    z.object({
      id,
      revision: z.number().int().nonnegative(),
      relationFingerprint: z.string().optional(),
      decisionId: id,
      title: z.string(),
      excerpt: z.string().nullable(),
    }),
  ),
  revision: z.number().int().nonnegative(),
  readOnly: z.boolean(),
});
export type DecisionSupersessionGraph = z.infer<
  typeof decisionSupersessionGraphSchema
>;
export type DecisionSupersessionSelection = z.infer<
  typeof decisionSupersessionSelectionSchema
>;
export type DecisionSupersessionCommand = z.infer<
  typeof decisionSupersessionCommandSchema
>;
export interface DecisionSupersessionPreview {
  changes: { id: string; before: string; after: string }[];
  command: Omit<DecisionSupersessionCommand, "clientIdempotencyKey">;
  graph: DecisionSupersessionGraph;
}
export interface DecisionSupersessionReceipt {
  committedAt: string;
  graph: DecisionSupersessionGraph;
  id: string;
}
export interface DecisionSupersessionAccess {
  commit: (
    accountId: string,
    input: DecisionSupersessionCommand,
  ) => Promise<DecisionSupersessionReceipt | null>;
  history: (
    accountId: string,
    projectId: string,
  ) => Promise<DecisionSupersessionTransition[] | null>;
  preview: (
    accountId: string,
    input: DecisionSupersessionSelection,
  ) => Promise<DecisionSupersessionPreview | null>;
  read: (
    accountId: string,
    projectId: string,
  ) => Promise<DecisionSupersessionGraph | null>;
}
