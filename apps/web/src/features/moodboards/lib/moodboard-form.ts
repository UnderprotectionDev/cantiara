import { moodboardSnapshotPreviewInputSchema } from "@cantiara/api/moodboard-snapshot";
import { z } from "zod";

/** Region `Snapshot` form: at least one chosen item, within the contract's bounds. */
export const snapshotItemsFormSchema = z.object({
  itemIds: moodboardSnapshotPreviewInputSchema.shape.itemIds,
});

export function captionOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
