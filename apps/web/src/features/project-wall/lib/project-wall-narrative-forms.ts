import { z } from "zod";

/** `Add Visual link` form: two different chosen cards and a trimmed label of at most 120 characters. */
export const drawVisualLinkFormSchema = z
  .object({
    fromCardId: z.string().min(1),
    label: z.string().trim().min(1).max(120),
    toCardId: z.string().min(1),
  })
  .refine((input) => input.fromCardId !== input.toCardId);

/** `Create Group` form: the name is trimmed and must not be empty. */
export const createGroupFormSchema = z.object({
  title: z.string().trim().min(1),
});
