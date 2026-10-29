import type { DocumentLiveDirective } from "@cantiara/api/documents";
import {
  documentLiveDirectives,
  documentRecordReferences,
} from "@cantiara/api/documents";
import {
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  attachmentEmbedId,
  backlinkEmbedId,
  childEmbedId,
  closeWikiBody,
  closeYoutubeLines,
  defaultWikiSlug,
  inlineReferenceEmbedId,
  liveBlockEmbedId,
  type PublishedWikiDocument,
  unresolvedPlaceholders,
  WIKI_PUBLISHING_ERROR_MESSAGES,
  WIKI_PUBLISHING_NOTICE,
  type WikiDocumentSnapshot,
  type WikiEmbedItem,
  type WikiEmbedKind,
  type WikiPlaceholderFinding,
  type WikiPreviewField,
  type WikiPreviewMember,
  type WikiPublication,
  type WikiPublishingAccess,
  WikiPublishingError,
  type WikiPublishPreview,
  type WikiSnapshotMember,
  wikiPublicPath,
  youtubeOccurrences,
} from "@cantiara/api/wiki-publishing";

export interface WikiSourceField extends WikiPreviewField {
  /** Closed field classification (PRD 13); a Secret field is never in scope. */
  classification?: "Secret";
}

export interface WikiSourceRecord {
  fields: WikiSourceField[];
  recordId: string;
  recordType: string;
  title: string;
  version: number | null;
}

export interface WikiSourceDocument extends WikiSourceRecord {
  body: string;
  workspaceId: string;
}

export interface WikiLiveSource extends WikiSourceRecord {
  /** The source named on the frozen block, e.g. the Smart Collection view. */
  sourceLabel: string;
}

/** Read-only facts owned by Documents, Smart Collections, Technical Diagrams and Source records. */
export interface WikiPublishingFacts {
  attachments: (
    accountId: string,
    documentId: string,
  ) => Promise<{ id: string; name: string; version: number }[]>;
  backlinks: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiSourceRecord[]>;
  childDocuments: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiSourceDocument[]>;
  /** An owned Personal Wiki Document, or null for anything else. */
  document: (
    accountId: string,
    documentId: string,
  ) => Promise<WikiSourceDocument | null>;
  liveSource: (
    accountId: string,
    directive: DocumentLiveDirective,
  ) => Promise<WikiLiveSource | null>;
  referenced: (
    accountId: string,
    reference: { recordId: string; recordType: string },
  ) => Promise<WikiSourceRecord | null>;
}

export interface WikiPublishWrite {
  accountId: string;
  documentId: string;
  snapshot: WikiDocumentSnapshot;
  workspaceId: string;
}

/** The Document's active (not cancelled) Wiki surface with its latest revision. */
export interface WikiActiveSurface {
  indexingEnabled: boolean;
  revision: number;
  slug: string;
  surfaceId: string;
}

export interface WikiPublishingStore {
  /** The active Wiki surface of one Document, or null when none is published. */
  active: (
    workspaceId: string,
    documentId: string,
  ) => Promise<WikiActiveSurface | null>;
  /**
   * Terminal: sets `cancelledAt` so the URL answers `410 Gone` from now on.
   * False when the surface was already cancelled (a concurrent unpublish won).
   */
  cancel: (surfaceId: string) => Promise<boolean>;
  /**
   * Atomic: reuse the Document's active Wiki surface or create an independent
   * one (no Project), then append the next Onaylı snapshot revizyonu. The
   * active check is repeated under a row lock, so a revision is never appended
   * to a surface that an unpublish cancelled first; a cancelled id is never reused.
   */
  publish: (write: WikiPublishWrite) => Promise<PublishedWikiDocument>;
  /** Explicit founder action only; publishing never writes this. False when the surface is cancelled. */
  setIndexing: (surfaceId: string, enabled: boolean) => Promise<boolean>;
}

export interface WikiPublishingOptions {
  facts: WikiPublishingFacts;
  now?: () => Date;
  store: WikiPublishingStore;
}

const LIVE_KIND: Record<DocumentLiveDirective["kind"], WikiEmbedKind> = {
  "Document section": "Live content section",
  "Smart Collection": "Live Smart Collection",
  "Technical Diagram": "Live Technical Diagram",
  Work: "Live Work",
};

function member(
  source: WikiSourceRecord,
  files: WikiPreviewMember["files"] = [],
): WikiPreviewMember {
  return {
    // Secret never enters scope; embedded Markdown cannot carry a record link out.
    fields: source.fields
      .filter((field) => field.classification !== "Secret")
      .map(({ name, value }) => ({
        name,
        value:
          name === "Body" ? closeWikiBody(value, new Set(), new Map()) : value,
      })),
    files,
    recordId: source.recordId,
    recordType: source.recordType,
    title: source.title,
    version: source.version,
  };
}

function notPublished() {
  return new WikiPublishingError(
    "WIKI_PUBLISHING_NOT_PUBLISHED",
    WIKI_PUBLISHING_ERROR_MESSAGES.WIKI_PUBLISHING_NOT_PUBLISHED,
  );
}

function publicationOf(
  documentId: string,
  surface: WikiActiveSurface | null,
): WikiPublication {
  return {
    documentId,
    indexingEnabled: surface?.indexingEnabled ?? false,
    path: surface ? wikiPublicPath(surface.surfaceId, surface.slug) : null,
    revision: surface?.revision ?? null,
    surfaceId: surface?.surfaceId ?? null,
  };
}

function placeholdersIn(
  target: WikiPreviewMember,
  embedId: string | null,
): WikiPlaceholderFinding[] {
  return target.fields.flatMap((field) =>
    unresolvedPlaceholders(field.value).map(({ context, name }) => ({
      context,
      embedId,
      field: field.name,
      name,
      sourceRecord: {
        id: target.recordId,
        title: target.title,
        type: target.recordType,
      },
    })),
  );
}

export function createWikiPublishing(
  options: WikiPublishingOptions,
): WikiPublishingAccess {
  const { facts, store } = options;
  const now = options.now ?? (() => new Date());

  async function build(accountId: string, documentId: string) {
    const root = await facts.document(accountId, documentId);
    if (!root) {
      return null;
    }
    const embeds: WikiEmbedItem[] = [];
    const seen = new Set<string>();
    const add = (item: WikiEmbedItem) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        embeds.push(item);
      }
    };

    for (const reference of documentRecordReferences(root.body)) {
      // biome-ignore lint/performance/noAwaitInLoops: embeds keep document order.
      const source = await facts.referenced(accountId, reference);
      if (source) {
        add({
          id: inlineReferenceEmbedId(reference.recordType, reference.recordId),
          kind: "Inline reference",
          liveSourceLabel: null,
          member: member(source),
        });
      }
    }
    for (const directive of documentLiveDirectives(root.body)) {
      // biome-ignore lint/performance/noAwaitInLoops: embeds keep document order.
      const source = await facts.liveSource(accountId, directive);
      if (source) {
        add({
          id: liveBlockEmbedId(directive),
          kind: LIVE_KIND[directive.kind],
          liveSourceLabel: source.sourceLabel,
          member: member(source),
        });
      }
    }
    const [children, backlinks, attachments] = await Promise.all([
      facts.childDocuments(accountId, documentId),
      facts.backlinks(accountId, documentId),
      facts.attachments(accountId, documentId),
    ]);
    // Every YouTube line is its own approval item, in body order, because the
    // public page renders one click-to-load card per line (PRD 14).
    for (const occurrence of youtubeOccurrences(root.body)) {
      add({
        id: occurrence.id,
        kind: "YouTube video",
        liveSourceLabel: null,
        member: {
          fields: [],
          files: [],
          recordId: occurrence.videoId,
          recordType: "YouTube video",
          title: occurrence.url,
          version: null,
        },
      });
    }
    for (const child of children) {
      add({
        id: childEmbedId(child.recordId),
        kind: "Child document",
        liveSourceLabel: null,
        member: member(child),
      });
    }
    for (const backlink of backlinks) {
      add({
        id: backlinkEmbedId(backlink.recordId),
        kind: "Backlink",
        liveSourceLabel: null,
        member: member(backlink),
      });
    }
    for (const file of attachments) {
      add({
        id: attachmentEmbedId(file.id),
        kind: "Attachment",
        liveSourceLabel: null,
        member: {
          fields: [],
          files: [
            { attachmentId: file.id, name: file.name, version: file.version },
          ],
          recordId: file.id,
          recordType: "File Attachment",
          title: file.name,
          version: file.version,
        },
      });
    }

    // The root keeps its own Markdown: its embeds are approved one by one below.
    const rootMember = member(root);
    rootMember.fields = rootMember.fields.map((field) =>
      field.name === "Body" ? { ...field, value: root.body } : field,
    );
    const placeholders = [
      ...placeholdersIn(rootMember, null),
      ...embeds.flatMap((embed) => placeholdersIn(embed.member, embed.id)),
    ];
    const preview: WikiPublishPreview = {
      documentId,
      embeds,
      fingerprint: await fingerprintMutationPayload({
        embeds,
        placeholders,
        root: rootMember,
      } as unknown as MutationPayload),
      notice: WIKI_PUBLISHING_NOTICE,
      placeholders,
      root: rootMember,
      written: false,
    };
    return { preview, root };
  }

  return {
    publication: async (accountId, documentId) => {
      const root = await facts.document(accountId, documentId);
      return root
        ? publicationOf(
            documentId,
            await store.active(root.workspaceId, documentId),
          )
        : null;
    },

    setIndexing: async (accountId, input) => {
      const root = await facts.document(accountId, input.documentId);
      if (!root) {
        return null;
      }
      if (input.enabled && !input.acknowledgeThirdPartyCopies) {
        throw new WikiPublishingError(
          "WIKI_PUBLISHING_INDEXING_UNACKNOWLEDGED",
          "Acknowledge that third-party copies cannot be fully recalled before enabling indexing.",
        );
      }
      const surface = await store.active(root.workspaceId, input.documentId);
      if (
        !(
          surface && (await store.setIndexing(surface.surfaceId, input.enabled))
        )
      ) {
        throw notPublished();
      }
      return publicationOf(input.documentId, {
        ...surface,
        indexingEnabled: input.enabled,
      });
    },

    unpublish: async (accountId, documentId) => {
      const root = await facts.document(accountId, documentId);
      if (!root) {
        return null;
      }
      const surface = await store.active(root.workspaceId, documentId);
      if (!(surface && (await store.cancel(surface.surfaceId)))) {
        throw notPublished();
      }
      return publicationOf(documentId, null);
    },

    preview: async (accountId, documentId) =>
      (await build(accountId, documentId))?.preview ?? null,

    publish: async (accountId, input) => {
      const built = await build(accountId, input.documentId);
      if (!built) {
        return null;
      }
      const { preview, root } = built;
      if (preview.fingerprint !== input.approval.fingerprint) {
        throw new WikiPublishingError(
          "WIKI_PUBLISHING_PREVIEW_STALE",
          "The preview changed. Review it again before publishing.",
        );
      }
      const approved = new Set(input.approval.approvedEmbedIds);
      const leaving = preview.placeholders.filter(
        (finding) => finding.embedId === null || approved.has(finding.embedId),
      );
      if (leaving.length > 0 && !input.approval.publishAnyway) {
        throw new WikiPublishingError(
          "WIKI_PUBLISHING_PLACEHOLDERS_UNRESOLVED",
          "Resolve the placeholders or confirm Publish/share anyway.",
        );
      }

      const approvedAt = now().toISOString();
      const date = approvedAt.slice(0, 10);
      const publicIds = new Map<string, string>();
      const members: WikiSnapshotMember[] = preview.embeds
        .filter((embed) => approved.has(embed.id))
        .map((embed, index) => {
          publicIds.set(embed.id, `member-${index + 1}`);
          return embed;
        })
        .map((embed) => ({
          ...embed.member,
          memberId: publicIds.get(embed.id) ?? "",
          kind: embed.kind,
          liveLabel: embed.liveSourceLabel
            ? `Snapshot of ${embed.liveSourceLabel} on ${date}`
            : null,
        }));
      const titles = new Map(
        preview.embeds.map((embed) => [embed.id, embed.member.title]),
      );
      const closed = closeWikiBody(root.body, approved, titles, publicIds);
      const snapshot: WikiDocumentSnapshot = {
        approvedAt,
        // YouTube lines are not part of closeWikiBody: they close at the root
        // only, where the public page renders the click-to-load cards. Member
        // bodies keep their URLs, and the published body keeps the closed
        // card markers instead of live lines.
        body: closeYoutubeLines(closed, approved, publicIds),
        documentId: root.recordId,
        documentRevision: root.version ?? 0,
        kind: "Wiki Document",
        members,
        slug: input.approval.slug ?? defaultWikiSlug(root.title),
        summary: input.approval.summary?.trim() || null,
        title: root.title,
      };
      return store.publish({
        accountId,
        documentId: root.recordId,
        snapshot,
        workspaceId: root.workspaceId,
      });
    },
  };
}
