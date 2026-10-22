import { z } from "zod";

/** The `Place live card` form: the chosen record's id; empty means nothing is chosen. */
export const placeCardFormSchema = z.object({
  recordId: z.string().min(1),
});
