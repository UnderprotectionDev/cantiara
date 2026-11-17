import {
  type PublishWikiDocumentInput,
  publishWikiDocumentInputSchema,
  setWikiIndexingInputSchema,
  type WikiPublishPreview,
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

/** What the publish form holds; the approval is built from it on submit. */
export interface WikiPublishFormValues {
  approved: string[];
  publishAnyway: boolean;
  slug: string;
  summary: string;
}

export const EMPTY_WIKI_PUBLISH_FORM: WikiPublishFormValues = {
  approved: [],
  publishAnyway: false,
  slug: "",
  summary: "",
};

/** Validates the built approval with the procedure's own approval schema. */
export function parseWikiPublishApproval(
  preview: WikiPublishPreview,
  values: WikiPublishFormValues,
):
  | { approval: PublishWikiDocumentInput["approval"]; ok: true }
  | { ok: false } {
  const result = publishWikiDocumentInputSchema.shape.approval.safeParse(
    buildWikiPublishApproval(
      preview,
      new Set(values.approved),
      values.publishAnyway,
      { slug: values.slug, summary: values.summary },
    ),
  );
  return result.success ? { approval: result.data, ok: true } : { ok: false };
}

const enableIndexingSchema = setWikiIndexingInputSchema.pick({
  acknowledgeThirdPartyCopies: true,
  enabled: true,
});

/**
 * `Enable indexing` needs the separate acknowledgement; nothing implies it.
 * Its control stays disabled until it is given, so a failure has no copy.
 */
export function parseEnableIndexing(values: { acknowledged: boolean }):
  | {
      input: { acknowledgeThirdPartyCopies: boolean; enabled: boolean };
      ok: true;
    }
  | { ok: false } {
  const result = enableIndexingSchema.safeParse({
    acknowledgeThirdPartyCopies: values.acknowledged,
    enabled: true,
  });
  if (!(result.success && result.data.acknowledgeThirdPartyCopies)) {
    return { ok: false };
  }
  return { input: result.data, ok: true };
}
