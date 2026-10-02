// biome-ignore-all lint/performance/noAwaitInLoops: recursive expansion shares one bounded budget and must not fan out concurrently.
import { z } from "zod";
import {
  type Document,
  type DocumentLiveDirective,
  documentIdSchema,
  documentLiveDirectives,
} from "./documents";
import {
  humanMutationEnvelopeSchema,
  type MutationContract,
} from "./mutation-and-undo";

export const documentTransferInputSchema = z
  .object({
    action: z.enum([
      "Move",
      "Copy",
      "Cancel External Surface",
      "Assign File Attachments",
    ]),
    documentId: documentIdSchema,
    targetProjectId: documentIdSchema.nullable(),
    childDocumentIds: z.array(documentIdSchema).max(100).default([]),
    sourceRevision: z.number().int().positive(),
    newDocumentId: documentIdSchema.optional(),
    attachmentIds: z.array(documentIdSchema).max(100).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.action === "Copy" &&
      (!input.newDocumentId || input.childDocumentIds.length)
    ) {
      context.addIssue({
        code: "custom",
        message: "Copy requires a new Document identity and no children.",
      });
    }
    if (input.action !== "Copy" && input.newDocumentId) {
      context.addIssue({
        code: "custom",
        message: "Move preserves Document identity.",
      });
    }
    if (
      input.action !== "Assign File Attachments" &&
      input.attachmentIds?.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Select File Attachments only when assigning ownership.",
      });
    }
    if (
      input.action === "Assign File Attachments" &&
      (!input.attachmentIds?.length ||
        input.childDocumentIds.length ||
        new Set(input.attachmentIds).size !== input.attachmentIds.length)
    ) {
      context.addIssue({
        code: "custom",
        message: "Select unique File Attachments for this Document.",
      });
    }
  });

export const documentTransferMutationInputSchema =
  humanMutationEnvelopeSchema.and(
    documentTransferInputSchema.extend({
      previewFingerprint: z.string().min(1),
    }),
  );
export type DocumentTransferInput = z.infer<typeof documentTransferInputSchema>;
export class DocumentTransferError extends Error {}
export interface DocumentTransferPreview {
  allowed: boolean;
  attachments: Array<{ id: string; name: string; revision: number }>;
  brokenReferences: Array<{ recordId: string; label: string }>;
  documents: Array<{ id: string; title: string; revision: number }>;
  externalSurfaceIds: string[];
  fingerprint: string;
  reason: string | null;
  targetLabel: string;
}
export interface DocumentTransferValue {
  command?: DocumentTransferInput & { previewFingerprint: string };
  document: Document | null;
}
export interface DocumentSnapshot {
  capturedAt: string;
  documentId: string;
  markdown: string;
  revision: number;
  title: string;
}
export interface DocumentTransfersAccess {
  mutation: (accountId: string) => MutationContract<DocumentTransferValue>;
  pdf: (snapshot: DocumentSnapshot) => Promise<string>;
  preview: (
    accountId: string,
    input: DocumentTransferInput,
  ) => Promise<DocumentTransferPreview>;
  replayCancellations: () => Promise<void>;
  snapshot: (
    accountId: string,
    documentId: string,
    revision: number,
  ) => Promise<DocumentSnapshot>;
}

export function selectDocumentMove(
  records: readonly { id: string; parentDocumentId: string | null }[],
  documentId: string,
  childDocumentIds: readonly string[],
): string[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  if (
    !byId.has(documentId) ||
    new Set(childDocumentIds).size !== childDocumentIds.length
  ) {
    throw new Error("Document selection is unavailable.");
  }
  for (const childId of childDocumentIds) {
    const visited = new Set<string>();
    let current = byId.get(childId);
    while (current && current.id !== documentId && !visited.has(current.id)) {
      visited.add(current.id);
      current = current.parentDocumentId
        ? byId.get(current.parentDocumentId)
        : undefined;
    }
    if (!current || current.id !== documentId || childId === documentId) {
      throw new Error("Select only child Documents of the source Document.");
    }
  }
  return [documentId, ...childDocumentIds];
}

export async function freezeDocumentLiveBlocks(
  body: string,
  capturedAt: string,
  resolve: (
    directive: DocumentLiveDirective,
  ) => Promise<{ label: string; text: string } | null>,
  ancestors: readonly string[] = [],
  budget = { remaining: 200, characters: 1_000_000 },
): Promise<string> {
  budget.characters -= body.length;
  if (budget.characters < 0) {
    throw new DocumentTransferError(
      "Document snapshot exceeds the export size limit.",
    );
  }
  let cursor = 0;
  let output = "";
  for (const directive of documentLiveDirectives(body)) {
    budget.remaining -= 1;
    if (budget.remaining < 0) {
      throw new DocumentTransferError(
        "Document snapshot exceeds the live block limit.",
      );
    }
    output += body.slice(cursor, directive.start);
    const identity = `${directive.kind}:${directive.id}:${directive.sectionId ?? directive.viewId ?? ""}`;
    const source =
      ancestors.includes(identity) || ancestors.length >= 20
        ? null
        : await resolve(directive);
    const text = source
      ? await freezeDocumentLiveBlocks(
          source.text,
          capturedAt,
          resolve,
          [...ancestors, identity],
          budget,
        )
      : "Source unavailable.";
    const label = (source?.label ?? directive.id).replace(/[\r\n]/g, " ");
    output += `> Snapshot — ${directive.kind}: ${label} — ${capturedAt}\n> Read-only snapshot; not a live copy.\n\n${text}\n`;
    cursor = directive.end;
  }
  return output + body.slice(cursor);
}
