import { z } from "zod";
import {
  type DocumentLiveDirective,
  documentIdSchema,
  type documentRecordReferences,
  documentRevisionSchema,
  projectIdSchema,
} from "./documents";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const fields = {
  documentId: documentIdSchema,
  documentRevision: documentRevisionSchema,
  targetProjectId: projectIdSchema.nullable(),
};

export const documentTransferInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...fields,
      action: z.literal("move"),
      children: z
        .array(
          z
            .object({ id: documentIdSchema, revision: documentRevisionSchema })
            .strict(),
        )
        .max(100),
    })
    .strict(),
  z
    .object({
      ...fields,
      action: z.literal("copy"),
      copyDocumentId: z.uuid(),
      sourceRevision: documentRevisionSchema,
    })
    .strict(),
]);

export const transferDocumentMutationInputSchema = z.discriminatedUnion(
  "action",
  [
    documentTransferInputSchema.options[0].extend({
      ...humanMutationEnvelopeSchema.shape,
      previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    documentTransferInputSchema.options[1].extend({
      ...humanMutationEnvelopeSchema.shape,
      previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ],
);

export type DocumentTransferInput = z.infer<typeof documentTransferInputSchema>;

export interface DocumentTransferPreview {
  allowed: boolean;
  attachments: Array<{
    id: string;
    name: string;
    ownerDocumentId: string | null;
    revision: number;
  }>;
  descendants: Array<{ id: string; title: string; revision: number }>;
  detachedChildren: Array<{ id: string; title: string; revision: number }>;
  documents: Array<{ id: string; title: string; revision: number }>;
  fingerprint: string;
  reason: string | null;
  references: Array<{
    recordType: string;
    id: string;
    title: string;
    reference?: ReturnType<typeof documentRecordReferences>[number];
    directive?: DocumentLiveDirective;
    available?: boolean;
    projectId?: string | null;
  }>;
  targetProjectId: string | null;
}
