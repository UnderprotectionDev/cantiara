import { z } from "zod";
import { versionPinnedEvidenceSchema } from "./evidence";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { sourceSelectionSchema } from "./sources-and-freshness";

const id = z.string().trim().min(1).max(255);
export const sourceEvidenceTargetSchema = z
  .object({
    projectId: id,
    recordId: id,
    type: z.enum([
      "Work",
      "Decision",
      "Feedback",
      "Risk",
      "Assumption",
      "Open Question",
    ]),
  })
  .strict();
export type SourceEvidenceTarget = z.infer<typeof sourceEvidenceTargetSchema>;
export const sourceEvidencePreviewInputSchema = sourceSelectionSchema
  .extend({
    bindingId: id.optional(),
    target: sourceEvidenceTargetSchema.optional(),
    expectedSourceRevision: z.number().int().positive(),
    versionRevision: z.number().int().positive(),
    start: z.number().int().nonnegative().safe(),
    end: z.number().int().positive().safe(),
  })
  .refine(
    (value) => Boolean(value.bindingId) !== Boolean(value.target),
    "Choose one existing bind or target.",
  );
export const sourceEvidencePlanSchema = z
  .object({
    pin: versionPinnedEvidenceSchema,
    target: sourceEvidenceTargetSchema,
    targetTitle: id,
    accessedAt: z.iso.datetime(),
    expectedSourceRevision: z.number().int().positive(),
    bindingId: id.nullable(),
    bindingRevision: z.number().int().nonnegative(),
  })
  .strict();
export type SourceEvidencePlan = z.infer<typeof sourceEvidencePlanSchema>;
export const bindSourceEvidenceInputSchema = humanMutationEnvelopeSchema.extend(
  {
    ...sourceSelectionSchema.shape,
    id,
    plan: sourceEvidencePlanSchema,
  },
);
export const reviewSourceEvidenceInputSchema = humanMutationEnvelopeSchema
  .extend({
    ...sourceSelectionSchema.shape,
    bindingId: id,
    expectedSourceRevision: z.number().int().positive(),
    decision: z.enum([
      "Reviewed; keep current version",
      "Rebind to new version",
    ]),
    plan: sourceEvidencePlanSchema.optional(),
  })
  .refine(
    (value) =>
      (value.decision === "Rebind to new version") === Boolean(value.plan),
    "Rebinding requires an exact-version preview.",
  );

export interface SourceEvidenceUse {
  accessedAt: string;
  id: string;
  newerVersionExists: boolean;
  pin: z.infer<typeof versionPinnedEvidenceSchema>;
  readOnly: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedSourceRevision: number | null;
  revision: number;
  role: string;
  target: SourceEvidenceTarget;
  targetTitle: string;
}
export interface SourceEvidenceListing {
  signal: {
    id: string;
    type: "source-version-in-use";
    sourceId: string;
    versionRevision: number;
    useIds: string[];
  } | null;
  uses: SourceEvidenceUse[];
}
export interface SourceEvidenceAccess {
  bind: (
    accountId: string,
    input: z.infer<typeof bindSourceEvidenceInputSchema>,
  ) => Promise<SourceEvidenceUse | null>;
  list: (
    accountId: string,
    input: z.infer<typeof sourceSelectionSchema>,
  ) => Promise<SourceEvidenceListing | null>;
  preview: (
    accountId: string,
    input: z.infer<typeof sourceEvidencePreviewInputSchema>,
  ) => Promise<SourceEvidencePlan | null>;
  review: (
    accountId: string,
    input: z.infer<typeof reviewSourceEvidenceInputSchema>,
  ) => Promise<SourceEvidenceUse | null>;
  targets: (
    accountId: string,
    input: z.infer<typeof sourceSelectionSchema>,
  ) => Promise<Array<SourceEvidenceTarget & { title: string }> | null>;
}

/** A unique literal match is only a suggestion for explicit preview; it never moves a pin. */
export function findSourceEvidenceMatch(excerpt: string, candidate: string) {
  const start = candidate.indexOf(excerpt);
  return start >= 0 && candidate.indexOf(excerpt, start + 1) === -1
    ? { start, end: start + excerpt.length }
    : null;
}
