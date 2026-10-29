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

/** Builds the approval from ticked embeds only; unticked embeds stay private. */
export function buildWikiPublishApproval(
  preview: WikiPublishPreview,
  approved: ReadonlySet<string>,
  publishAnyway: boolean,
): PublishWikiDocumentInput["approval"] {
  return {
    approvedEmbedIds: preview.embeds
      .filter((embed) => approved.has(embed.id))
      .map((embed) => embed.id),
    fingerprint: preview.fingerprint,
    publishAnyway,
  };
}
