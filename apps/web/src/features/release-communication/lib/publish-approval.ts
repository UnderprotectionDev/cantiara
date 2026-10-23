import type {
  PublishPreview,
  PublishReleaseNoteInput,
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
