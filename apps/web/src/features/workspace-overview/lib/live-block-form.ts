import { z } from "zod";

export const MAX_LIVE_BLOCKS = 4;

/**
 * The Add live block choice: one existing source that is still addable while
 * the overview holds fewer than the maximum number of live blocks. The Add
 * live block control is disabled otherwise, so no message exists for it.
 */
export function liveBlockFormSchema(
  addableKeys: ReadonlySet<string>,
  selectedCount: number,
) {
  return z.object({
    choice: z
      .string()
      .min(1)
      .refine((choice) => addableKeys.has(choice))
      .refine(() => selectedCount < MAX_LIVE_BLOCKS),
  });
}
