import type { ShareItem, ShareScopePreview } from "@cantiara/api/link-sharing";
import { z } from "zod";

export interface ShareScopeFormDraft {
  /** Item ids the founder approved. */
  approved: string[];
  /** Approved field ids the founder marked `Live`. */
  live: string[];
  /** The separate `Publish/share anyway` confirmation. */
  publishAnyway: boolean;
}

export const shareScopeFormSchema = z.object({
  approved: z.array(z.string()),
  live: z.array(z.string()),
  publishAnyway: z.boolean(),
});

/**
 * Starting selection. A first preview approves nothing implicitly except the
 * records and fields it lists; a version or view group starts unchosen. On an
 * existing surface only what was approved before stays checked, so a new
 * candidate or new content waits for an explicit choice.
 */
export function defaultShareScopeDraft(
  preview: ShareScopePreview,
): ShareScopeFormDraft {
  const known = preview.surface !== null;
  const approved = preview.items.filter(
    (item) =>
      item.selectable &&
      !item.candidate &&
      !item.leavesScope &&
      (known ? item.state !== "Never approved" : item.group === null),
  );
  return {
    approved: approved.map((item) => item.itemId),
    live: approved.filter((item) => item.live).map((item) => item.itemId),
    publishAnyway: false,
  };
}

/** Groups that still need exactly one choice among their record's approved items. */
export function groupsNeedingChoice(
  preview: ShareScopePreview,
  approved: readonly string[],
) {
  const chosen = new Set(approved);
  const counts = new Map<string, number>();
  for (const item of preview.items) {
    if (item.group && item.parentId && chosen.has(item.parentId)) {
      const key = `${item.parentId}|${item.group}`;
      counts.set(
        key,
        (counts.get(key) ?? 0) + (chosen.has(item.itemId) ? 1 : 0),
      );
    }
  }
  return [...counts]
    .filter(([, count]) => count !== 1)
    .map(([key]) => key.split("|")[1] ?? key);
}

export interface ShareItemSection {
  groups: { items: ShareItem[]; name: string }[];
  items: ShareItem[];
  record: ShareItem;
}

/** Items grouped under their Record, with exclusive-choice groups separated. */
export function shareItemSections(
  preview: ShareScopePreview,
): ShareItemSection[] {
  return preview.items
    .filter((item) => item.kind === "Record")
    .map((record) => {
      const children = preview.items.filter(
        (item) => item.parentId === record.itemId,
      );
      const groupNames = [
        ...new Set(
          children.flatMap((item) => (item.group ? [item.group] : [])),
        ),
      ];
      return {
        groups: groupNames.map((name) => ({
          items: children.filter((item) => item.group === name),
          name,
        })),
        items: children.filter((item) => !item.group),
        record,
      };
    });
}
