import { z } from "zod";

/** `Paste rows` form: any pasted text; `Preview paste` reports a missing header or data row. */
export const recordTablePasteTextFormSchema = z.object({
  pasteText: z.string(),
});

/** `Correct row` form: the edited values by field name; untouched fields keep their reviewed value. */
export const recordTablePasteCorrectionFormSchema = z.record(
  z.string(),
  z.string(),
);
