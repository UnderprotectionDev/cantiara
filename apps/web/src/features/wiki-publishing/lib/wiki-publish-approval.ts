import type {
  PublishWikiDocumentInput,
  WikiPublishPreview,
} from "@cantiara/api/wiki-publishing";

export function toggledEmbed(
  approved: ReadonlySet<string>,
  embedId: string,
  on: boolean,
) {
  const next = new Set(approved);
  if (on) {
    next.add(embedId);
  } else {
    next.delete(embedId);
  }
  return next;
}

/** Placeholders that would leave: those of the Document itself and of approved embeds. */
export function leavingPlaceholders(
  preview: WikiPublishPreview,
  approved: ReadonlySet<string>,
) {
  return preview.placeholders.filter(
    (finding) => finding.embedId === null || approved.has(finding.embedId),
  );
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Empty means the server derives the slug from the Document title. */
export function isValidWikiSlug(slug: string) {
  const value = slug.trim();
  return value === "" || (value.length <= 80 && SLUG_PATTERN.test(value));
}

/**
 * Builds the approval from ticked embeds only; unticked embeds stay private.
 * Slug and summary belong to the Wiki page and are never read from a Project.
 */
export function buildWikiPublishApproval(
  preview: WikiPublishPreview,
  approved: ReadonlySet<string>,
  publishAnyway: boolean,
  metadata: { slug?: string; summary?: string } = {},
): PublishWikiDocumentInput["approval"] {
  const slug = metadata.slug?.trim();
  const summary = metadata.summary?.trim();
  return {
    approvedEmbedIds: preview.embeds
      .filter((embed) => approved.has(embed.id))
      .map((embed) => embed.id),
    fingerprint: preview.fingerprint,
    publishAnyway,
    ...(slug ? { slug } : {}),
    ...(summary ? { summary } : {}),
  };
}
