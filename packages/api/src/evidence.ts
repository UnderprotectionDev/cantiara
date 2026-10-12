import { z } from "zod";

const id = z.string().trim().min(1).max(255);
export const evidenceSourceSchema = z
  .object({
    recordType: id,
    recordId: id,
    projectId: id,
    revision: z.number().int().nonnegative().safe(),
    componentId: id.nullable(),
  })
  .strict();
export const versionPinnedEvidenceSchema = z
  .object({
    source: evidenceSourceSchema,
    start: z.number().int().nonnegative().safe(),
    end: z.number().int().positive().safe(),
    excerpt: z
      .string()
      .min(1)
      .max(100_000)
      .refine(
        (value) => value.trim().length > 0,
        "Choose text containing more than whitespace.",
      ),
    before: z.string().max(120),
    after: z.string().max(120),
  })
  .strict()
  .refine(
    ({ start, end, excerpt }) => end > start && end - start === excerpt.length,
    "Choose a nonempty exact text range.",
  );
export type VersionPinnedEvidence = z.infer<typeof versionPinnedEvidenceSchema>;

/** Offsets use UTF-16 code units, like browser text selection and String.slice. */
export function pinEvidenceText(
  source: z.infer<typeof evidenceSourceSchema>,
  text: string,
  start: number,
  end: number,
): VersionPinnedEvidence {
  if (end > text.length) {
    throw new Error("The selected text range is unavailable.");
  }
  return versionPinnedEvidenceSchema.parse({
    source,
    start,
    end,
    excerpt: text.slice(start, end),
    before: text.slice(Math.max(0, start - 120), start),
    after: text.slice(end, end + 120),
  });
}
