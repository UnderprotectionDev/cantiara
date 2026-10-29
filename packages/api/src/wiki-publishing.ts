import { z } from "zod";

import { placeholderRanges } from "./document-templates";
import { documentLiveDirectives, documentRecordReferences } from "./documents";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const WIKI_PUBLISHING_UI_LABELS = {
  disableIndexing: "Disable indexing",
  enableIndexing: "Enable indexing",
  liveExternalSource: "Live external source",
  publishAnyway: "Publish/share anyway",
  publishWikiDocument: "Publish Wiki Document",
  unpublish: "Unpublish",
} as const;

export const WIKI_INDEXING_WARNING =
  "Search engines and other third parties may keep copies of this page. Those copies cannot be fully recalled, even if you unpublish or disable indexing later.";

const wikiSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use lowercase letters, digits and -.");

const TRAILING_DASHES = /-+$/u;

/** Readable default slug from the Belge title; independent of any Project metadata. */
export function defaultWikiSlug(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80)
    .replace(TRAILING_DASHES, "");
  return slug || "wiki";
}

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
  "YouTube video",
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
        /** Public slug; defaults from the Document title and never from Build in Public. */
        slug: wikiSlugSchema.optional(),
        /** Optional document-specific public summary. */
        summary: z.string().trim().max(300).nullable().optional(),
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
  /** Readable URL segment; decorative, never used for access or redirects. */
  slug: string;
  /** Document-specific public summary; does not make the page indexable. */
  summary: string | null;
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
  "WIKI_PUBLISHING_INDEXING_UNACKNOWLEDGED",
  "WIKI_PUBLISHING_NOT_PUBLISHED",
  "WIKI_PUBLISHING_PLACEHOLDERS_UNRESOLVED",
  "WIKI_PUBLISHING_PREVIEW_STALE",
] as const;
export type WikiPublishingErrorCode =
  (typeof WIKI_PUBLISHING_ERROR_CODES)[number];

/** Founder-facing text for each typed error; the UI shows this instead of a raw code. */
export const WIKI_PUBLISHING_ERROR_MESSAGES: Record<
  WikiPublishingErrorCode,
  string
> = {
  WIKI_PUBLISHING_INDEXING_UNACKNOWLEDGED:
    "Acknowledge that third-party copies cannot be fully recalled before enabling indexing.",
  WIKI_PUBLISHING_NOT_PUBLISHED:
    "This Document is not published. Refresh to see its current state.",
  WIKI_PUBLISHING_PLACEHOLDERS_UNRESOLVED:
    "Resolve the placeholders or confirm Publish/share anyway.",
  WIKI_PUBLISHING_PREVIEW_STALE:
    "The preview changed. Review it again before publishing.",
};

export class WikiPublishingError extends Error {
  readonly code: WikiPublishingErrorCode;

  constructor(code: WikiPublishingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WikiPublishingError";
  }
}

export const wikiPublicationInputSchema = z
  .object({ documentId: identifierSchema })
  .strict();

export const unpublishWikiDocumentInputSchema = humanMutationEnvelopeSchema
  .extend({ documentId: identifierSchema })
  .strict();

export const setWikiIndexingInputSchema = humanMutationEnvelopeSchema
  .extend({
    /** Required for `enabled: true`; never implied by anything else. */
    acknowledgeThirdPartyCopies: z.boolean(),
    documentId: identifierSchema,
    enabled: z.boolean(),
  })
  .strict();
export type SetWikiIndexingInput = z.infer<typeof setWikiIndexingInputSchema>;

/** The Document's current public state; null `surfaceId` means it is not published. */
export interface WikiPublication {
  documentId: string;
  indexingEnabled: boolean;
  /** Path of the public page; ends with the current slug. */
  path: string | null;
  revision: number | null;
  surfaceId: string | null;
}

/** The public page path. The surface id carries access; the slug is only readable text. */
export function wikiPublicPath(surfaceId: string, slug: string) {
  return `/w/${surfaceId}/${slug}`;
}

export interface WikiPublishingAccess {
  preview: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiPublishPreview | null>;
  /** Unpublish is terminal for the URL: the surface is cancelled and never reused. */
  publication: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiPublication | null>;
  publish: (
    accountId: string,
    input: Omit<
      PublishWikiDocumentInput,
      "baseRevision" | "clientIdempotencyKey"
    >,
  ) => Promise<PublishedWikiDocument | null>;
  setIndexing: (
    accountId: string,
    input: {
      acknowledgeThirdPartyCopies: boolean;
      documentId: string;
      enabled: boolean;
    },
  ) => Promise<WikiPublication | null>;
  unpublish: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiPublication | null>;
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

/** One full-line YouTube URL in the Markdown; the public page turns it into a click-to-load card. */
export interface WikiYoutubeOccurrence {
  end: number;
  /** Stable per line in body order (`youtube:0`, `youtube:1`); the card's embed id. */
  id: string;
  start: number;
  /** The original URL text kept on the card. */
  url: string;
  videoId: string;
}

const YOUTUBE_LINE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:[^\s#]*&)?v=|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[&?#][^\s]*)?$/u;

/** Each YouTube line of one text, in order, with its own embed id and exact range. */
export function youtubeOccurrences(body: string): WikiYoutubeOccurrence[] {
  const occurrences: WikiYoutubeOccurrence[] = [];
  let offset = 0;
  for (const line of body.split("\n")) {
    const end = offset + line.length;
    const match = YOUTUBE_LINE.exec(line.trim());
    const videoId = match?.[1];
    if (videoId) {
      occurrences.push({
        end,
        id: `youtube:${occurrences.length}`,
        start: offset,
        url: line.trim(),
        videoId,
      });
    }
    offset = end + 1;
  }
  return occurrences;
}

function applyReplacements(
  body: string,
  replacements: { end: number; start: number; text: string }[],
) {
  let result = "";
  let offset = 0;
  for (const replacement of [...replacements].sort(
    (left, right) => left.start - right.start,
  )) {
    if (replacement.start < offset) {
      continue;
    }
    result += body.slice(offset, replacement.start) + replacement.text;
    offset = replacement.end;
  }
  return result + body.slice(offset);
}

/** The closed marker of one approved YouTube card, mirroring the live-block marker. */
function youtubeCardMarker(publicId: string | undefined) {
  return `:::youtube{memberId="${publicId ?? ""}"}`;
}

/**
 * The YouTube cards of the public Markdown. Closed world: an unapproved card
 * line vanishes and an approved one becomes the frozen card marker; the plain
 * URL is never kept as a live page line.
 */
export function closeYoutubeLines(
  body: string,
  approvedEmbedIds: ReadonlySet<string>,
  publicIds: ReadonlyMap<string, string> = new Map(),
) {
  return applyReplacements(
    body,
    youtubeOccurrences(body).map((occurrence) => ({
      end: occurrence.end,
      start: occurrence.start,
      text: approvedEmbedIds.has(occurrence.id)
        ? youtubeCardMarker(publicIds.get(occurrence.id))
        : "",
    })),
  );
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
  return applyReplacements(body, [
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
  ]);
}
