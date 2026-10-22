import {
  DOCUMENT_EVIDENCE_TARGET_TYPES,
  pinDocumentEvidenceInputSchema,
} from "@cantiara/api/documents";
import { z } from "zod";

export const DOCUMENT_CONVERSION_RECORD_TYPES = [
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
] as const;
export type DocumentConversionRecordType =
  (typeof DOCUMENT_CONVERSION_RECORD_TYPES)[number];

/** `Version-pinned evidence` form: a record type and an existing record of that type. */
export const pinDocumentEvidenceFormSchema = z.object({
  targetRecordId: pinDocumentEvidenceInputSchema.shape.targetRecordId,
  targetRecordType: z.enum(DOCUMENT_EVIDENCE_TARGET_TYPES),
});

/** `Convert to record` form: a record type and a non-empty title. */
export const convertDocumentTextToRecordFormSchema = z.object({
  recordType: z.enum(DOCUMENT_CONVERSION_RECORD_TYPES),
  title: z.string().trim().min(1),
});

/** `Convert in bulk` form: at least one saved list row. */
export const convertDocumentListToWorkFormSchema = z.object({
  selectedKeys: z.array(z.string()).min(1),
});
