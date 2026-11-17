import {
  type PublishPreview,
  type PublishReleaseNoteInput,
  publishReleaseNoteInputSchema,
} from "@cantiara/api/release-communication";

/** What the founder ticked in the publish-close preview; nothing is ticked by default. */
export interface PublishSelection {
  eventIds: ReadonlySet<string>;
  /** `<sourceType>/<sourceId>/<field name>` keys. */
  fieldKeys: ReadonlySet<string>;
  linkHrefs: ReadonlySet<string>;
  workIds: ReadonlySet<string>;
}

export const EMPTY_PUBLISH_SELECTION: PublishSelection = {
  eventIds: new Set(),
  fieldKeys: new Set(),
  linkHrefs: new Set(),
  workIds: new Set(),
};

export function whyTrailFieldKey(
  item: { sourceId: string; sourceType: string },
  fieldName: string,
) {
  return `${item.sourceType}/${item.sourceId}/${fieldName}`;
}

export function toggled<T>(set: ReadonlySet<T>, value: T, on: boolean) {
  const next = new Set(set);
  if (on) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}

/** Builds the approval from ticked items only; unticked proposals stay private. */
export function buildPublishApproval(
  preview: PublishPreview,
  selection: PublishSelection,
): PublishReleaseNoteInput["approval"] {
  return {
    buildInPublicEventIds: preview.buildInPublicEvents
      .filter((event) => selection.eventIds.has(event.id))
      .map((event) => event.id),
    changelogLinkHrefs: preview.changelogLinks
      .filter((link) => selection.linkHrefs.has(link.href))
      .map((link) => link.href),
    fingerprint: preview.fingerprint,
    publicLabels: preview.scope.flatMap((item) =>
      item.proposedPublicLabel && selection.workIds.has(item.workId)
        ? [{ label: item.proposedPublicLabel, workId: item.workId }]
        : [],
    ),
    whyTrail: preview.whyTrail.map((item) => ({
      approvedFields: item.proposedFields
        .filter((field) =>
          selection.fieldKeys.has(whyTrailFieldKey(item, field.name)),
        )
        .map((field) => field.name),
      sourceId: item.sourceId,
      sourceType: item.sourceType,
    })),
  };
}

/** What the publish form holds: the ticked items, as arrays the form can store. */
export interface PublishFormValues {
  eventIds: string[];
  fieldKeys: string[];
  linkHrefs: string[];
  workIds: string[];
}

export const EMPTY_PUBLISH_FORM: PublishFormValues = {
  eventIds: [],
  fieldKeys: [],
  linkHrefs: [],
  workIds: [],
};

export function selectionOf(values: PublishFormValues): PublishSelection {
  return {
    eventIds: new Set(values.eventIds),
    fieldKeys: new Set(values.fieldKeys),
    linkHrefs: new Set(values.linkHrefs),
    workIds: new Set(values.workIds),
  };
}

/**
 * Validates the built approval with the procedure's own approval schema. The
 * Publish control is disabled in every state the schema rejects, so a failure
 * has no copy.
 */
export function parsePublishApproval(
  preview: PublishPreview,
  values: PublishFormValues,
): { approval: PublishReleaseNoteInput["approval"]; ok: true } | { ok: false } {
  const result = publishReleaseNoteInputSchema.shape.approval.safeParse(
    buildPublishApproval(preview, selectionOf(values)),
  );
  return result.success ? { approval: result.data, ok: true } : { ok: false };
}
