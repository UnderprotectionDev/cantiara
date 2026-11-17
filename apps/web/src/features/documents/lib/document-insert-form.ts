import { z } from "zod";

const ALLOWED_LINK_PATTERN = /^(https?:\/\/|mailto:)/i;

/** `Link` popover: an http, https or mailto URL with a host (or mail target). */
export const documentLinkFormSchema = z.object({
  url: z
    .string()
    .trim()
    .refine((value) => {
      if (!ALLOWED_LINK_PATTERN.test(value)) {
        return false;
      }
      try {
        const url = new URL(value);
        return url.protocol === "mailto:" ? !!url.pathname : !!url.hostname;
      } catch {
        return false;
      }
    }, "Use an http, https, or mailto URL."),
});

/** `Insert formula` popover: a non-empty LaTeX source, inline or block. */
export const documentFormulaFormSchema = z.object({
  latex: z.string().trim().min(1, "LaTeX is required."),
  placement: z.enum(["inline", "block"]),
});
