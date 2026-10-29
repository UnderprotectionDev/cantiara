import type {
  ApproveBuildInPublicInput,
  BuildInPublicItem,
  BuildInPublicPreview,
} from "@cantiara/api/build-in-public";

export function toggledItem(
  approved: ReadonlySet<string>,
  itemId: string,
  on: boolean,
) {
  const next = new Set(approved);
  if (on) {
    next.add(itemId);
  } else {
    // A dependent item never leaves without its Work.
    next.delete(itemId);
  }
  return next;
}

/**
 * Items that would leave: ticked Roadmap Works, ticked dependents of a ticked
 * Work, and ticked metadata. Mirrors the server's closed-world rule.
 */
export function leavingItems(
  preview: BuildInPublicPreview,
  approved: ReadonlySet<string>,
) {
  const works = new Set(
    preview.items
      .filter((item) => item.kind === "Roadmap Work" && approved.has(item.id))
      .map((item) => item.id),
  );
  return preview.items.filter((item) => {
    if (!approved.has(item.id)) {
      return false;
    }
    return item.parentId === null ? true : works.has(item.parentId);
  });
}

export function leavingPlaceholders(
  preview: BuildInPublicPreview,
  approved: ReadonlySet<string>,
) {
  const leaving = new Set(leavingItems(preview, approved).map((i) => i.id));
  return preview.placeholders.filter((finding) => leaving.has(finding.itemId));
}

/** Works that would leave without a Public Status Label (or an approved Released label). */
export function unlabeledWorks(
  preview: BuildInPublicPreview,
  approved: ReadonlySet<string>,
) {
  const leaving = new Set(leavingItems(preview, approved).map((i) => i.id));
  return preview.items.filter(
    (item) =>
      item.kind === "Roadmap Work" &&
      leaving.has(item.id) &&
      !item.publicStatusLabel &&
      !leaving.has(`released:${item.workId}`),
  );
}

/** Only items that were already approved with identical content start ticked. */
export function initialApproved(preview: BuildInPublicPreview) {
  return new Set(
    preview.items
      .filter((item) => item.change === "Unchanged")
      .map((item) => item.id),
  );
}

export function buildApproval(
  preview: BuildInPublicPreview,
  approved: ReadonlySet<string>,
  publishAnyway: boolean,
): ApproveBuildInPublicInput["approval"] {
  const hasMetadata = preview.metadata.title || preview.metadata.summary;
  return {
    approvedItemIds: preview.items
      .filter((item) => approved.has(item.id))
      .map((item) => item.id),
    fingerprint: preview.fingerprint,
    ...(hasMetadata ? { metadata: preview.metadata } : {}),
    publishAnyway,
  };
}

/** Roadmap Works with their dependents, in preview order. */
export function groupedItems(preview: BuildInPublicPreview) {
  const groups: { dependents: BuildInPublicItem[]; item: BuildInPublicItem }[] =
    [];
  for (const item of preview.items) {
    if (item.parentId === null) {
      groups.push({ dependents: [], item });
    } else {
      groups
        .find((group) => group.item.id === item.parentId)
        ?.dependents.push(item);
    }
  }
  return groups;
}
