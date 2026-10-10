import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifier = z.string().trim().min(1).max(255);
const timestamp = z.iso.datetime({ offset: true });
const sourceCaptureFields = {
  url: z
    .url({ protocol: /^https?$/ })
    .max(8192)
    .refine((value) => {
      const url = new URL(value);
      return !(url.username || url.password);
    }, "Source URLs must not contain credentials."),
  title: z.string().trim().min(1).max(255),
  accessedAt: timestamp,
  // Plain captured text is historical data; whitespace is part of the capture.
  capturedContent: z.string().max(100_000),
  provider: identifier.nullable().optional().default(null),
  externalRecordType: identifier.nullable().optional().default(null),
  externalId: identifier.nullable().optional().default(null),
};

export const createSourceInputSchema = humanMutationEnvelopeSchema
  .extend({
    ...sourceCaptureFields,
    id: identifier,
    projectId: identifier,
  })
  .strict();
export const saveSourceVersionInputSchema = humanMutationEnvelopeSchema
  .extend({
    ...sourceCaptureFields,
    sourceId: identifier,
    projectId: identifier,
  })
  .strict();
export const sourceSelectionSchema = z
  .object({ sourceId: identifier, projectId: identifier })
  .strict();
export const sourceProjectInputSchema = z
  .object({ projectId: identifier })
  .strict();

export const sourceVersionSchema = z
  .object({
    ...sourceCaptureFields,
    sourceId: identifier,
    revision: z.number().int().positive().safe(),
    savedAt: timestamp,
  })
  .strict();
export const sourceRecordSchema = z
  .object({
    id: identifier,
    projectId: identifier,
    sourceType: z.literal("Source"),
    revision: z.number().int().positive().safe(),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: sourceVersionSchema,
  })
  .strict();
export type SourceRecord = z.output<typeof sourceRecordSchema>;
export type SourceVersion = z.output<typeof sourceVersionSchema>;

export interface SourcesAndFreshnessAccess {
  create: (
    accountId: string,
    input: z.input<typeof createSourceInputSchema>,
  ) => Promise<SourceRecord | null>;
  find: (
    accountId: string,
    input: z.input<typeof sourceSelectionSchema>,
  ) => Promise<{
    record: SourceRecord;
    versions: SourceVersion[];
    readOnly: boolean;
  } | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<{ records: SourceRecord[]; readOnly: boolean } | null>;
  saveVersion: (
    accountId: string,
    input: z.input<typeof saveSourceVersionInputSchema>,
  ) => Promise<SourceRecord | null>;
}

export class SourceConflictError extends Error {
  readonly code = "CONFLICT";
  readonly targetId: string;
  constructor(targetId: string, options?: ErrorOptions) {
    super("Source changed. Reload before saving.", options);
    this.name = "SourceConflictError";
    this.targetId = targetId;
  }
}
