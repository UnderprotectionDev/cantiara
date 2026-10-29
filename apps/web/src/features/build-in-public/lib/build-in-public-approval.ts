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
  const roots = new Set(
    preview.items
      .filter(
        (item) =>
          (item.kind === "Roadmap Work" || item.kind === "Project member") &&
          approved.has(item.id),
      )
      .map((item) => item.id),
  );
  return preview.items.filter((item) => {
    if (!approved.has(item.id)) {
      return false;
    }
    return item.parentId === null ? true : roots.has(item.parentId);
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

const MEMBER_PREFIX = "member:";

/**
 * Approved Proje Sürümü and Karar items the founder may feature. Nothing is
 * featured unless one of them is picked together with an end time.
 */
export function featureCandidates(
  preview: BuildInPublicPreview,
  approved: ReadonlySet<string>,
) {
  return leavingItems(preview, approved).filter(
    (item) =>
      item.kind === "Project member" &&
      (item.memberKind === "Decision" || item.memberKind === "Project Release"),
  );
}

/** The source record id of a Project member item. */
export function memberRecordId(item: BuildInPublicItem) {
  return item.id.startsWith(MEMBER_PREFIX)
    ? item.id.slice(MEMBER_PREFIX.length)
    : item.id;
}

/** `yyyy-MM-ddTHH:mm` (local) to the ISO instant the contract takes; empty or invalid is no window. */
export function featuredEndsAt(local: string) {
  const time = local ? new Date(local).getTime() : Number.NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function buildApproval(
  preview: BuildInPublicPreview,
  approved: ReadonlySet<string>,
  publishAnyway: boolean,
  featured?: { endsAt: string; recordId: string } | null,
): ApproveBuildInPublicInput["approval"] {
  const { summary, title, changelogIndex, roadmapIndex } = preview.metadata;
  const hasMetadata = title || summary || changelogIndex || roadmapIndex;
  return {
    approvedItemIds: preview.items
      .filter((item) => approved.has(item.id))
      .map((item) => item.id),
    // Omitted keeps the earlier choice; the founder clears it with null.
    ...(featured === undefined ? {} : { featured }),
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
