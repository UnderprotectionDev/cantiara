import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { sourceFetchResultSchema } from "./smart-link-preview";
import {
  sourceSelectionSchema,
  sourceVersionSchema,
} from "./sources-and-freshness";

const identifier = z.string().trim().min(1).max(255);
export const recheckSourceInputSchema = sourceSelectionSchema.extend({
  id: identifier,
  expectedSourceRevision: z.number().int().positive(),
});
export const sourceCheckDecisionInputSchema =
  humanMutationEnvelopeSchema.extend({
    ...sourceSelectionSchema.shape,
    checkId: identifier,
    expectedSourceRevision: z.number().int().positive(),
    decision: z.enum(["Keep current version", "Save as new Source version"]),
  });
export const sourceCheckSchema = z
  .object({
    id: identifier,
    sourceId: identifier,
    revision: z.number().int().positive(),
    comparedRevision: z.number().int().positive(),
    checkedAt: z.iso.datetime(),
    checkedBy: identifier,
    startUrl: z.url({ protocol: /^https?$/ }),
    fetchResult: sourceFetchResultSchema.nullable(),
    fingerprint: z.string().nullable(),
    error: z.string().nullable(),
    candidate: sourceVersionSchema
      .omit({ revision: true, savedAt: true })
      .nullable(),
    decision: z
      .enum(["Keep current version", "Save as new Source version"])
      .nullable(),
    approvedRevision: z.number().int().positive().nullable(),
  })
  .strict();
export type SourceCheck = z.infer<typeof sourceCheckSchema>;
export interface SourceRecheckAccess {
  decide: (
    accountId: string,
    input: z.infer<typeof sourceCheckDecisionInputSchema>,
  ) => Promise<SourceCheck | null>;
  list: (
    accountId: string,
    input: z.infer<typeof sourceSelectionSchema>,
  ) => Promise<SourceCheck[] | null>;
  recheck: (
    accountId: string,
    input: z.infer<typeof recheckSourceInputSchema>,
  ) => Promise<SourceCheck | null>;
}
