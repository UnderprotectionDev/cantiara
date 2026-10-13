import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const id = z.string().trim().min(1).max(255);
export const riskContextRelationInputSchema = z
  .object({
    ...humanMutationEnvelopeSchema.shape,
    projectId: id,
    riskId: id,
    targetType: z.enum(["Project Release", "Focus Period"]),
    targetId: id,
  })
  .strict();
export type RiskContextRelationInput = z.infer<
  typeof riskContextRelationInputSchema
>;
export const riskSourceEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("entered-open"), id }),
  z.object({
    type: z.literal("related-context"),
    id,
    targetType: z.enum(["Project Release", "Focus Period"]),
    targetId: id,
  }),
]);
export type RiskSourceEvent = z.infer<typeof riskSourceEventSchema>;
export const riskAttentionSignalSchema = z.object({
  signalId: z.string(),
  signalType: z.literal("open-risk"),
  presentation: z.literal("Action Required"),
  sourceRiskId: id,
  projectId: id,
  sourceEvent: riskSourceEventSchema,
  impact: z.string().nullable(),
  probability: z.string().nullable(),
  sourcePath: z.string(),
  occurredAt: z.iso.datetime(),
});
export type RiskAttentionSignal = z.infer<typeof riskAttentionSignalSchema>;
export interface RiskContextRelation {
  id: string;
  revision: number;
  riskId: string;
  targetId: string;
  targetType: "Project Release" | "Focus Period";
}
export interface RiskSignalsAccess {
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<RiskAttentionSignal[] | null>;
  relate: (
    accountId: string,
    input: RiskContextRelationInput,
  ) => Promise<RiskContextRelation | null>;
}

export function openRiskSignal(
  source: {
    id: string;
    projectId: string;
    life: string;
    impact: string | null;
    probability: string | null;
  },
  sourceEvent: RiskSourceEvent,
  contextStatus?: string,
) {
  if (source.life !== "Open") {
    return null;
  }
  if (
    sourceEvent.type === "related-context" &&
    contextStatus !==
      (sourceEvent.targetType === "Project Release" ? "Preparing" : "Active")
  ) {
    return null;
  }
  return {
    signalType: "open-risk" as const,
    presentation: "Action Required" as const,
    sourceRiskId: source.id,
    projectId: source.projectId,
    sourceEvent,
    impact: source.impact,
    probability: source.probability,
    sourcePath: `/projects/${encodeURIComponent(source.projectId)}#source-risk-${encodeURIComponent(source.id)}`,
  };
}
