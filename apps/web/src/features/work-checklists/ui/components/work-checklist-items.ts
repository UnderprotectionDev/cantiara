import type { WorkChecklistItem } from "@cantiara/api/work-lifecycle";

// Checklist text edits live in local drafts until a save reaches the server.
// Every save sends the resolved list so an unsaved edit rides along with a
// sibling item action instead of being silently discarded by it.
export function resolveChecklistDrafts(
  checklist: WorkChecklistItem[],
  drafts: Record<string, string>,
): WorkChecklistItem[] {
  return checklist.map((item) => {
    const draft = drafts[item.id]?.trim();
    return draft ? { ...item, text: draft } : item;
  });
}
