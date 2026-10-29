import { z } from "zod";

import { placeholderRanges } from "./document-templates";
import { documentLiveDirectives, documentRecordReferences } from "./documents";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const WIKI_PUBLISHING_UI_LABELS = {
  publishAnyway: "Publish/share anyway",
  publishWikiDocument: "Publish Wiki Document",
} as const;

export const WIKI_PUBLISHING_NOTICE =
  "Free text, URLs and file metadata are not scanned for secrets. Secret fields, share tokens and link passwords are never part of a Wiki publish.";

export const WIKI_EMBED_KINDS = [
  "Inline reference",
  "Backlink",
  "Attachment",
  "Child document",
  "Live Smart Collection",
  "Live content section",
  "Live Work",
  "Live Technical Diagram",
] as const;
export type WikiEmbedKind = (typeof WIKI_EMBED_KINDS)[number];

export interface WikiPreviewField {
  name: string;
  value: string;
}

/** One exact record, its version, the fields and the Dosya Ekleri that would leave. */
export interface WikiPreviewMember {
  fields: WikiPreviewField[];
  files: { attachmentId: string; name: string; version: number }[];
  recordId: string;
  recordType: string;
  title: string;
  /** Document revision or File Attachment version; null when the owner has none. */
  version: number | null;
}

export interface WikiEmbedItem {
  /** Stable per embed; the founder approves each id on its own. */
  id: string;
  kind: WikiEmbedKind;
  /** Live blocks only: the source named on the frozen block; the date is the approval time. */
  liveSourceLabel: string | null;
  member: WikiPreviewMember;
}

export interface WikiPlaceholderFinding {
  /** Surrounding text of the match. */
  context: string;
  /** Null for the Wiki Document itself; otherwise the embed it sits in. */
  embedId: string | null;
  field: string;
  name: string;
  sourceRecord: { id: string; title: string; type: string };
}

export interface WikiPublishPreview {
  documentId: string;
  embeds: WikiEmbedItem[];
  /** Stale when the Document or any previewed source changes before approval. */
  fingerprint: string;
  notice: string;
  placeholders: WikiPlaceholderFinding[];
  root: WikiPreviewMember;
  /** The preview writes nothing and creates no surface. */
  written: false;
}

export const wikiPublishPreviewInputSchema = z
  .object({ documentId: identifierSchema })
  .strict();

export const publishWikiDocumentInputSchema = humanMutationEnvelopeSchema
  .extend({
    approval: z
      .object({
        approvedEmbedIds: z.array(identifierSchema).max(500),
        fingerprint: z.string().trim().min(1).max(200),
        /** Separate from scope approval; never implied by it. */
        publishAnyway: z.boolean(),
      })
      .strict(),
    documentId: identifierSchema,
  })
  .strict();
export type PublishWikiDocumentInput = z.infer<
  typeof publishWikiDocumentInputSchema
>;

/** One approved member of the frozen snapshot. */
export interface WikiSnapshotMember extends WikiPreviewMember {
  kind: WikiEmbedKind;
  /** `Snapshot of <source> on <date>` for frozen live blocks; read-only, no link to a private record. */
  liveLabel: string | null;
  /** Opaque (`member-1`); the preview's embed id names a source and stays private. */
  memberId: string;
}

export interface WikiDocumentSnapshot {
  approvedAt: string;
  /** Root Markdown with every unapproved embed removed. */
  body: string;
  documentId: string;
  documentRevision: number;
  kind: "Wiki Document";
  members: WikiSnapshotMember[];
  title: string;
}

export interface PublishedWikiDocument {
  approvedAt: string;
  documentId: string;
  /** Always null: a Wiki publish never creates a Project Build in Public surface. */
  projectId: null;
  revision: number;
  surfaceId: string;
}

export const WIKI_PUBLISHING_ERROR_CODES = [
  "WIKI_PUBLISHING_PLACEHOLDERS_UNRESOLVED",
  "WIKI_PUBLISHING_PREVIEW_STALE",
] as const;
export type WikiPublishingErrorCode =
  (typeof WIKI_PUBLISHING_ERROR_CODES)[number];

export class WikiPublishingError extends Error {
  readonly code: WikiPublishingErrorCode;

  constructor(code: WikiPublishingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WikiPublishingError";
  }
}

export interface WikiPublishingAccess {
  preview: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiPublishPreview | null>;
  publish: (
    accountId: string,
    input: Omit<
      PublishWikiDocumentInput,
      "baseRevision" | "clientIdempotencyKey"
    >,
  ) => Promise<PublishedWikiDocument | null>;
}

/* -------------------------------------------------------------------------- */
/* Pure rules                                                                  */
/* -------------------------------------------------------------------------- */

export function inlineReferenceEmbedId(recordType: string, recordId: string) {
  return `inline:${recordType}:${recordId}`;
}

export function liveBlockEmbedId(directive: {
  id: string;
  kind: string;
  sectionId?: string;
  versionId?: string;
}) {
  return `live:${directive.kind}:${directive.id}:${directive.sectionId ?? ""}:${directive.versionId ?? ""}`;
}

export function childEmbedId(documentId: string) {
  return `child:${documentId}`;
}
export function backlinkEmbedId(documentId: string) {
  return `backlink:${documentId}`;
}
export function attachmentEmbedId(attachmentId: string) {
  return `attachment:${attachmentId}`;
}

const CONTEXT_RADIUS = 40;

/** Unresolved `{{field_name}}` in one text with the surrounding text; code matches are ignored. */
export function unresolvedPlaceholders(text: string) {
  return placeholderRanges(text).map(({ end, name, start }) => ({
    context: text
      .slice(Math.max(0, start - CONTEXT_RADIUS), end + CONTEXT_RADIUS)
      .replace(/\s+/g, " ")
      .trim(),
    name,
  }));
}

/**
 * The public Markdown of the Wiki Document. Closed world: an unapproved
 * inline reference or live block vanishes without a gap marker, and an
 * approved one becomes plain text or a snapshot marker, never a record link.
 */
export function closeWikiBody(
  body: string,
  approvedEmbedIds: ReadonlySet<string>,
  titles: ReadonlyMap<string, string>,
  /** Opaque public ids of the approved embeds; source identities never leave. */
  publicIds: ReadonlyMap<string, string> = new Map(),
) {
  const replacements = [
    ...documentRecordReferences(body).map(
      ({ end, recordId, recordType, start }) => {
        const id = inlineReferenceEmbedId(recordType, recordId);
        return {
          end,
          start,
          text: approvedEmbedIds.has(id) ? (titles.get(id) ?? "") : "",
        };
      },
    ),
    ...documentLiveDirectives(body).map((directive) => {
      const id = liveBlockEmbedId(directive);
      return {
        end: directive.end,
        start: directive.start,
        text: approvedEmbedIds.has(id)
          ? `:::snapshot-block{memberId="${publicIds.get(id) ?? ""}"}`
          : "",
      };
    }),
  ].sort((left, right) => left.start - right.start);
  let result = "";
  let offset = 0;
  for (const replacement of replacements) {
    if (replacement.start < offset) {
      continue;
    }
    result += body.slice(offset, replacement.start) + replacement.text;
    offset = replacement.end;
  }
  return result + body.slice(offset);
}
